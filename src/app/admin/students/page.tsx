'use client';

import JSZip from 'jszip';
import { useEffect, useMemo, useState } from 'react';
import { AuthGuard } from '@/components/auth/auth-guard';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/ui/page-header';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { StatusPopper } from '@/components/ui/status-popper';
import {
    bulkUpsertStudentRegistry,
    deleteStudentRegistryEntry,
    fetchStudentRegistry,
    upsertStudentRegistryEntry,
} from '@/lib/supabase';
import type {
    StudentRegistryEntry,
    StudentRegistryStatus,
    StudentRegistryUpsertInput,
} from '@/lib/types';

type ParsedStudentRow = {
    rowNumber: number;
    values: Record<string, string>;
};

type StudentFormState = {
    usn: string;
    firstName: string;
    lastName: string;
    course: string;
    yearLevel: string;
    email: string;
    status: StudentRegistryStatus;
};

const REQUIRED_HEADERS = ['usn', 'first_name', 'last_name', 'email'];
const EXPECTED_HEADERS = [
    'usn',
    'first_name',
    'last_name',
    'course',
    'year_level',
    'email',
    'status',
];

function emptyFormState(): StudentFormState {
    return {
        usn: '',
        firstName: '',
        lastName: '',
        course: '',
        yearLevel: '',
        email: '',
        status: 'active',
    };
}

function normalizeHeader(value: string): string {
    return value.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function normalizeCellText(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
}

function columnIndexToLetters(index: number): string {
    let current = Math.max(1, Math.trunc(index));
    let letters = '';
    while (current > 0) {
        const modulo = (current - 1) % 26;
        letters = String.fromCharCode(65 + modulo) + letters;
        current = Math.floor((current - modulo) / 26);
    }
    return letters;
}

function columnLettersFromCellRef(cellRef: string | null): string {
    if (!cellRef) return '';
    const match = cellRef.match(/[A-Za-z]+/);
    return (match?.[0] ?? '').toUpperCase();
}

function getFirstElementText(parent: Element, tagName: string): string {
    const element = parent.getElementsByTagName(tagName)[0];
    return element?.textContent ?? '';
}

function parseSharedStrings(sharedStringsXml: string): string[] {
    const parser = new DOMParser();
    const document = parser.parseFromString(
        sharedStringsXml,
        'application/xml',
    );
    const items = Array.from(document.getElementsByTagName('si'));
    return items.map((item) => {
        const textNodes = Array.from(item.getElementsByTagName('t'));
        if (textNodes.length === 0) {
            return normalizeCellText(item.textContent ?? '');
        }
        return normalizeCellText(
            textNodes.map((node) => node.textContent ?? '').join(''),
        );
    });
}

function getCellValue(cell: Element, sharedStrings: string[]): string {
    const cellType = cell.getAttribute('t');
    if (cellType === 'inlineStr') {
        const inlineText = getFirstElementText(cell, 't');
        return normalizeCellText(inlineText);
    }

    const rawValue = getFirstElementText(cell, 'v');
    if (!rawValue) return '';
    if (cellType === 's') {
        const index = Number(rawValue);
        if (Number.isFinite(index) && index >= 0) {
            return normalizeCellText(sharedStrings[index] ?? '');
        }
    }
    return normalizeCellText(rawValue);
}

async function parseStudentXlsx(file: File): Promise<ParsedStudentRow[]> {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const workbookXml = await zip.file('xl/workbook.xml')?.async('text');
    if (!workbookXml) {
        throw new Error('Invalid .xlsx file: workbook.xml is missing.');
    }
    const workbookRelsXml = await zip
        .file('xl/_rels/workbook.xml.rels')
        ?.async('text');
    if (!workbookRelsXml) {
        throw new Error('Invalid .xlsx file: workbook relationships are missing.');
    }

    const parser = new DOMParser();
    const workbookDoc = parser.parseFromString(workbookXml, 'application/xml');
    const relsDoc = parser.parseFromString(workbookRelsXml, 'application/xml');
    const firstSheet = workbookDoc.getElementsByTagName('sheet')[0];
    if (!firstSheet) {
        throw new Error('No worksheet found in .xlsx file.');
    }

    const relationId =
        firstSheet.getAttribute('r:id') ??
        firstSheet.getAttribute('id') ??
        firstSheet.getAttributeNS(
            'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
            'id',
        );
    if (!relationId) {
        throw new Error('Worksheet relationship id is missing.');
    }

    const relationships = Array.from(
        relsDoc.getElementsByTagName('Relationship'),
    );
    const relation = relationships.find(
        (item) => item.getAttribute('Id') === relationId,
    );
    if (!relation) {
        throw new Error('Worksheet relationship target not found.');
    }

    const target = relation.getAttribute('Target');
    if (!target) {
        throw new Error('Worksheet target path is missing.');
    }
    const normalizedTarget = target.replace(/^\/+/, '');
    const sheetPath = normalizedTarget.startsWith('xl/')
        ? normalizedTarget
        : `xl/${normalizedTarget.replace(/^\/+/, '')}`;

    const sheetXml = await zip.file(sheetPath)?.async('text');
    if (!sheetXml) {
        throw new Error('Worksheet XML content is missing.');
    }

    const sharedStringsXml = await zip
        .file('xl/sharedStrings.xml')
        ?.async('text');
    const sharedStrings = sharedStringsXml
        ? parseSharedStrings(sharedStringsXml)
        : [];

    const sheetDoc = parser.parseFromString(sheetXml, 'application/xml');
    const rowNodes = Array.from(sheetDoc.getElementsByTagName('row'));
    if (rowNodes.length === 0) {
        return [];
    }

    const extractedRows = rowNodes.map((rowNode, rowIndex) => {
        const rowNumber = Number(rowNode.getAttribute('r') ?? rowIndex + 1);
        const cells = new Map<string, string>();
        const cellNodes = Array.from(rowNode.getElementsByTagName('c'));
        cellNodes.forEach((cellNode, cellIndex) => {
            const fromRef = columnLettersFromCellRef(cellNode.getAttribute('r'));
            const column = fromRef || columnIndexToLetters(cellIndex + 1);
            cells.set(column, getCellValue(cellNode, sharedStrings));
        });
        return { rowNumber, cells };
    });

    const headerRow = extractedRows[0];
    const headerByColumn = new Map<string, string>();
    headerRow.cells.forEach((value, column) => {
        const normalized = normalizeHeader(value);
        if (normalized) {
            headerByColumn.set(column, normalized);
        }
    });

    const missingHeaders = REQUIRED_HEADERS.filter(
        (header) =>
            !Array.from(headerByColumn.values()).some((value) => value === header),
    );
    if (missingHeaders.length > 0) {
        throw new Error(
            `Missing required header(s): ${missingHeaders.join(', ')}.`,
        );
    }

    const parsedRows: ParsedStudentRow[] = [];
    for (const row of extractedRows.slice(1)) {
        const values: Record<string, string> = {};
        headerByColumn.forEach((header, column) => {
            values[header] = normalizeCellText(row.cells.get(column) ?? '');
        });

        const hasAnyValue = EXPECTED_HEADERS.some(
            (header) => (values[header] ?? '').trim() !== '',
        );
        if (!hasAnyValue) continue;
        parsedRows.push({ rowNumber: row.rowNumber, values });
    }

    return parsedRows;
}

function toUpsertInput(form: StudentFormState): StudentRegistryUpsertInput {
    const yearLevelRaw = form.yearLevel.trim();
    return {
        usn: form.usn,
        firstName: form.firstName,
        lastName: form.lastName,
        course: form.course,
        yearLevel: yearLevelRaw ? Number(yearLevelRaw) : undefined,
        email: form.email,
        status: form.status,
    };
}

function toFormState(entry: StudentRegistryEntry): StudentFormState {
    return {
        usn: entry.usn,
        firstName: entry.firstName,
        lastName: entry.lastName,
        course: entry.course ?? '',
        yearLevel:
            typeof entry.yearLevel === 'number' ? String(entry.yearLevel) : '',
        email: entry.email,
        status: entry.status,
    };
}

function validateImportRows(rows: ParsedStudentRow[]): {
    cleanRows: StudentRegistryUpsertInput[];
    errors: string[];
} {
    const errors: string[] = [];
    const cleanRows: StudentRegistryUpsertInput[] = [];
    const seenUsn = new Set<string>();
    const seenEmail = new Set<string>();

    rows.forEach((row) => {
        const usn = (row.values.usn ?? '').trim().toUpperCase();
        const firstName = (row.values.first_name ?? '').trim();
        const lastName = (row.values.last_name ?? '').trim();
        const course = (row.values.course ?? '').trim();
        const yearLevelRaw = (row.values.year_level ?? '').trim();
        const email = (row.values.email ?? '').trim().toLowerCase();
        const statusRaw = (row.values.status ?? '').trim().toLowerCase();

        if (!usn) {
            errors.push(`Row ${row.rowNumber}: USN is required.`);
        }
        if (!firstName) {
            errors.push(`Row ${row.rowNumber}: first_name is required.`);
        }
        if (!lastName) {
            errors.push(`Row ${row.rowNumber}: last_name is required.`);
        }
        if (!email) {
            errors.push(`Row ${row.rowNumber}: email is required.`);
        } else {
            const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailPattern.test(email)) {
                errors.push(`Row ${row.rowNumber}: email is invalid.`);
            }
        }

        if (statusRaw && statusRaw !== 'active' && statusRaw !== 'inactive') {
            errors.push(
                `Row ${row.rowNumber}: status must be active or inactive.`,
            );
        }

        let parsedYearLevel: number | undefined;
        if (yearLevelRaw) {
            const value = Number(yearLevelRaw);
            if (!Number.isInteger(value) || value < 1 || value > 12) {
                errors.push(
                    `Row ${row.rowNumber}: year_level must be an integer from 1 to 12.`,
                );
            } else {
                parsedYearLevel = value;
            }
        }

        if (usn) {
            if (seenUsn.has(usn)) {
                errors.push(`Row ${row.rowNumber}: duplicate USN "${usn}" in file.`);
            }
            seenUsn.add(usn);
        }

        if (email) {
            if (seenEmail.has(email)) {
                errors.push(
                    `Row ${row.rowNumber}: duplicate email "${email}" in file.`,
                );
            }
            seenEmail.add(email);
        }

        cleanRows.push({
            usn,
            firstName,
            lastName,
            course: course || undefined,
            yearLevel: parsedYearLevel,
            email,
            status: statusRaw === 'inactive' ? 'inactive' : 'active',
        });
    });

    return { cleanRows, errors };
}

export default function AdminStudentsPage() {
    const [students, setStudents] = useState<StudentRegistryEntry[]>([]);
    const [status, setStatus] = useState('Loading student registry...');
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState('');

    const [form, setForm] = useState<StudentFormState>(emptyFormState());
    const [editingId, setEditingId] = useState('');
    const [saveBusy, setSaveBusy] = useState(false);

    const [importFile, setImportFile] = useState<File | null>(null);
    const [importBusy, setImportBusy] = useState(false);

    const [deleteTarget, setDeleteTarget] = useState<StudentRegistryEntry | null>(
        null,
    );
    const [deleteBusy, setDeleteBusy] = useState(false);

    const [popper, setPopper] = useState<{
        message: string;
        tone: 'success' | 'error';
    } | null>(null);

    const filteredStudents = useMemo(() => {
        const term = query.trim().toLowerCase();
        if (!term) return students;
        return students.filter((student) => {
            return (
                student.usn.toLowerCase().includes(term) ||
                student.fullName.toLowerCase().includes(term) ||
                student.email.toLowerCase().includes(term) ||
                (student.course ?? '').toLowerCase().includes(term)
            );
        });
    }, [query, students]);

    function resetForm() {
        setEditingId('');
        setForm(emptyFormState());
    }

    async function loadStudents() {
        setLoading(true);
        try {
            const rows = await fetchStudentRegistry();
            setStudents(rows);
            setStatus(rows.length === 0 ? 'No student rows yet.' : '');
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Failed to load student registry.';
            setStatus(message);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void loadStudents();
    }, []);

    async function onSaveStudent() {
        if (saveBusy) return;
        setSaveBusy(true);
        setStatus('');
        try {
            await upsertStudentRegistryEntry({
                id: editingId || undefined,
                ...toUpsertInput(form),
            });
            await loadStudents();
            setPopper({
                message: editingId
                    ? 'Student row updated.'
                    : 'Student row saved.',
                tone: 'success',
            });
            resetForm();
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Failed to save student row.';
            setStatus(message);
            setPopper({ message, tone: 'error' });
        } finally {
            setSaveBusy(false);
        }
    }

    function onEditStudent(student: StudentRegistryEntry) {
        setEditingId(student.id);
        setForm(toFormState(student));
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    async function onConfirmDelete() {
        if (!deleteTarget || deleteBusy) return;
        setDeleteBusy(true);
        try {
            await deleteStudentRegistryEntry(deleteTarget.id);
            await loadStudents();
            if (editingId === deleteTarget.id) {
                resetForm();
            }
            setDeleteTarget(null);
            setPopper({
                message: 'Student row deleted.',
                tone: 'success',
            });
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Failed to delete student row.';
            setStatus(message);
            setPopper({ message, tone: 'error' });
        } finally {
            setDeleteBusy(false);
        }
    }

    async function onImportStudents() {
        if (importBusy) return;
        if (!importFile) {
            const message = 'Select an .xlsx file first.';
            setStatus(message);
            setPopper({ message, tone: 'error' });
            return;
        }

        setImportBusy(true);
        setStatus('');
        try {
            const parsedRows = await parseStudentXlsx(importFile);
            if (parsedRows.length === 0) {
                throw new Error('The uploaded file has no data rows to import.');
            }
            const { cleanRows, errors } = validateImportRows(parsedRows);
            if (errors.length > 0) {
                const preview = errors.slice(0, 5).join(' ');
                throw new Error(
                    `Import blocked by ${errors.length} validation issue(s). ${preview}`,
                );
            }

            const result = await bulkUpsertStudentRegistry(cleanRows);
            setImportFile(null);
            await loadStudents();
            setPopper({
                message: `Imported ${result.upserted} row(s) successfully.`,
                tone: 'success',
            });
        } catch (error) {
            const message =
                error instanceof Error ? error.message : 'Import failed.';
            setStatus(message);
            setPopper({ message, tone: 'error' });
        } finally {
            setImportBusy(false);
        }
    }

    return (
        <AuthGuard roles={['admin']}>
            <AppShell>
                <PageHeader
                    eyebrow='Admin'
                    title='Student Registry'
                    description='Import and manage student/member roster with USN, names, course, year level, email, and status.'
                />

                {status ? (
                    <p className='mb-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600'>
                        {status}
                    </p>
                ) : null}

                <section className='mb-4 grid gap-4 xl:grid-cols-2'>
                    <article className='rounded-3xl border border-slate-200 bg-white p-5 shadow-sm'>
                        <h2 className='text-base font-bold text-slate-900'>
                            Import from Excel
                        </h2>
                        <p className='mt-1 text-xs text-slate-500'>
                            Required headers: usn, first_name, last_name, email.
                        </p>
                        <p className='mt-1 text-xs text-slate-500'>
                            Optional headers: course, year_level, status.
                        </p>
                        <p className='mt-1 text-xs text-slate-500'>
                            Format: usn | first_name | last_name | course |
                            year_level | email | status
                        </p>
                        <div className='mt-3 flex flex-col gap-2 sm:flex-row sm:items-center'>
                            <input
                                type='file'
                                accept='.xlsx'
                                onChange={(event) =>
                                    setImportFile(
                                        event.target.files?.[0] ?? null,
                                    )
                                }
                                className='w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-white hover:file:bg-slate-700'
                            />
                            <button
                                type='button'
                                onClick={() => void onImportStudents()}
                                disabled={importBusy}
                                className='rounded-xl bg-cyan-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60'
                            >
                                {importBusy ? 'Importing...' : 'Import .xlsx'}
                            </button>
                        </div>
                        {importFile ? (
                            <p className='mt-2 text-xs text-slate-500'>
                                Selected: {importFile.name}
                            </p>
                        ) : null}
                    </article>

                    <article className='rounded-3xl border border-slate-200 bg-white p-5 shadow-sm'>
                        <h2 className='text-base font-bold text-slate-900'>
                            {editingId ? 'Edit Student' : 'Add Student'}
                        </h2>
                        <div className='mt-3 grid gap-2 sm:grid-cols-2'>
                            <input
                                value={form.usn}
                                onChange={(event) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        usn: event.target.value,
                                    }))
                                }
                                placeholder='USN'
                                className='rounded-xl border border-slate-300 px-3 py-2 text-xs outline-none focus:border-cyan-600'
                            />
                            <input
                                value={form.email}
                                onChange={(event) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        email: event.target.value,
                                    }))
                                }
                                placeholder='Email'
                                className='rounded-xl border border-slate-300 px-3 py-2 text-xs outline-none focus:border-cyan-600'
                            />
                            <input
                                value={form.firstName}
                                onChange={(event) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        firstName: event.target.value,
                                    }))
                                }
                                placeholder='First name'
                                className='rounded-xl border border-slate-300 px-3 py-2 text-xs outline-none focus:border-cyan-600'
                            />
                            <input
                                value={form.lastName}
                                onChange={(event) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        lastName: event.target.value,
                                    }))
                                }
                                placeholder='Last name'
                                className='rounded-xl border border-slate-300 px-3 py-2 text-xs outline-none focus:border-cyan-600'
                            />
                            <input
                                value={form.course}
                                onChange={(event) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        course: event.target.value,
                                    }))
                                }
                                placeholder='Course'
                                className='rounded-xl border border-slate-300 px-3 py-2 text-xs outline-none focus:border-cyan-600'
                            />
                            <input
                                value={form.yearLevel}
                                onChange={(event) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        yearLevel: event.target.value,
                                    }))
                                }
                                placeholder='Year level'
                                className='rounded-xl border border-slate-300 px-3 py-2 text-xs outline-none focus:border-cyan-600'
                            />
                            <select
                                value={form.status}
                                onChange={(event) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        status: event.target
                                            .value as StudentRegistryStatus,
                                    }))
                                }
                                className='rounded-xl border border-slate-300 px-3 py-2 text-xs outline-none focus:border-cyan-600'
                            >
                                <option value='active'>Active</option>
                                <option value='inactive'>Inactive</option>
                            </select>
                            <div className='flex gap-2'>
                                <button
                                    type='button'
                                    onClick={() => void onSaveStudent()}
                                    disabled={saveBusy}
                                    className='rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60'
                                >
                                    {saveBusy ? 'Saving...' : 'Save'}
                                </button>
                                {editingId ? (
                                    <button
                                        type='button'
                                        onClick={resetForm}
                                        disabled={saveBusy}
                                        className='rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60'
                                    >
                                        Cancel
                                    </button>
                                ) : null}
                            </div>
                        </div>
                    </article>
                </section>

                <section className='overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm'>
                    <div className='border-b border-slate-200 p-4'>
                        <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
                            <p className='text-sm font-semibold text-slate-800'>
                                Students: {students.length}
                            </p>
                            <input
                                value={query}
                                onChange={(event) =>
                                    setQuery(event.target.value)
                                }
                                placeholder='Search by USN, name, email, course'
                                className='w-full rounded-xl border border-slate-300 px-3 py-2 text-xs outline-none focus:border-cyan-600 sm:max-w-sm'
                            />
                        </div>
                    </div>
                    <div className='overflow-x-auto'>
                        <table className='w-full min-w-[860px] text-left text-sm'>
                            <thead className='bg-slate-50 text-slate-600'>
                                <tr>
                                    <th className='px-4 py-3'>USN</th>
                                    <th className='px-4 py-3'>Name</th>
                                    <th className='px-4 py-3'>Course</th>
                                    <th className='px-4 py-3'>Year</th>
                                    <th className='px-4 py-3'>Email</th>
                                    <th className='px-4 py-3'>Status</th>
                                    <th className='px-4 py-3'>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td
                                            colSpan={7}
                                            className='px-4 py-6 text-center text-slate-500'
                                        >
                                            Loading...
                                        </td>
                                    </tr>
                                ) : filteredStudents.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={7}
                                            className='px-4 py-6 text-center text-slate-500'
                                        >
                                            No student rows found.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredStudents.map((student) => (
                                        <tr
                                            key={student.id}
                                            className='border-t border-slate-200'
                                        >
                                            <td className='px-4 py-3 font-medium text-slate-800'>
                                                {student.usn}
                                            </td>
                                            <td className='px-4 py-3'>
                                                {student.fullName}
                                            </td>
                                            <td className='px-4 py-3'>
                                                {student.course ?? '-'}
                                            </td>
                                            <td className='px-4 py-3'>
                                                {student.yearLevel ?? '-'}
                                            </td>
                                            <td className='px-4 py-3 text-slate-600'>
                                                {student.email}
                                            </td>
                                            <td className='px-4 py-3'>
                                                <span
                                                    className={`rounded-full px-2 py-1 text-[11px] font-semibold uppercase ${
                                                        student.status ===
                                                        'active'
                                                            ? 'bg-emerald-100 text-emerald-800'
                                                            : 'bg-slate-200 text-slate-700'
                                                    }`}
                                                >
                                                    {student.status}
                                                </span>
                                            </td>
                                            <td className='px-4 py-3'>
                                                <div className='flex items-center gap-2'>
                                                    <button
                                                        type='button'
                                                        onClick={() =>
                                                            onEditStudent(student)
                                                        }
                                                        className='rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100'
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        type='button'
                                                        onClick={() =>
                                                            setDeleteTarget(
                                                                student,
                                                            )
                                                        }
                                                        className='rounded-lg border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-100'
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>

                <ConfirmDialog
                    open={Boolean(deleteTarget)}
                    title='Delete this student row?'
                    description='This action permanently removes this registry entry.'
                    confirmLabel='Delete'
                    busy={deleteBusy}
                    onCancel={() => {
                        if (deleteBusy) return;
                        setDeleteTarget(null);
                    }}
                    onConfirm={() => {
                        void onConfirmDelete();
                    }}
                />
                <StatusPopper
                    open={Boolean(popper)}
                    message={popper?.message ?? ''}
                    tone={popper?.tone ?? 'info'}
                    onClose={() => setPopper(null)}
                />
            </AppShell>
        </AuthGuard>
    );
}
