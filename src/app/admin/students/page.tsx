'use client';

import JSZip from 'jszip';
import {
    Button,
    Input,
    Modal,
    ModalBody,
    ModalContent,
    ModalFooter,
    ModalHeader,
    useDraggable,
} from '@heroui/react';
import { motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { AuthGuard } from '@/components/auth/auth-guard';
import { AdminPanelShell } from '@/components/admin/admin-panel-shell';
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
    status: StudentRegistryStatus;
};
type StudentSortField =
    | 'firstName'
    | 'lastName'
    | 'yearLevel'
    | 'course'
    | 'status';
type SortDirection = 'asc' | 'desc';

type ImportWorkbook = {
    name: string;
    bytes: ArrayBuffer;
};

const REQUIRED_HEADERS = ['usn', 'first_name', 'last_name'];
const EXPECTED_HEADERS = [
    'usn',
    'first_name',
    'last_name',
    'course',
    'year_level',
    'status',
];
const DEFAULT_ROWS_PER_PAGE = 10;
const MAX_PAGE_BUTTONS = 5;
const STUDENT_SORT_OPTIONS: Array<{ value: StudentSortField; label: string }> =
    [
        { value: 'firstName', label: 'First name' },
        { value: 'lastName', label: 'Last name' },
        { value: 'yearLevel', label: 'Year' },
        { value: 'course', label: 'Course' },
        { value: 'status', label: 'Status' },
    ];
const STUDENT_MODAL_INPUT_CLASS_NAMES = {
    inputWrapper:
        'border border-white/70 bg-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] data-[hover=true]:border-sky-200 data-[focus=true]:border-sky-400',
    input: 'text-sm text-slate-700 placeholder:text-slate-400  focus:outline-none focus:ring-0',
};

function getVisiblePageNumbers(
    currentPage: number,
    totalPages: number,
): number[] {
    if (totalPages <= MAX_PAGE_BUTTONS) {
        return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    const halfWindow = Math.floor(MAX_PAGE_BUTTONS / 2);
    let start = Math.max(1, currentPage - halfWindow);
    let end = start + MAX_PAGE_BUTTONS - 1;

    if (end > totalPages) {
        end = totalPages;
        start = end - MAX_PAGE_BUTTONS + 1;
    }

    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function emptyFormState(): StudentFormState {
    return {
        usn: '',
        firstName: '',
        lastName: '',
        course: '',
        yearLevel: '',
        status: 'active',
    };
}

function normalizeHeader(value: string): string {
    return value
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, '_');
}

function normalizeCellText(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
}

function compareTextValues(valueA: string, valueB: string): number {
    return valueA.localeCompare(valueB, undefined, {
        sensitivity: 'base',
        numeric: true,
    });
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

async function parseStudentXlsx(
    workbookBytes: ArrayBuffer,
): Promise<ParsedStudentRow[]> {
    const zip = await JSZip.loadAsync(workbookBytes);
    const workbookXml = await zip.file('xl/workbook.xml')?.async('text');
    if (!workbookXml) {
        throw new Error('Invalid .xlsx file: workbook.xml is missing.');
    }
    const workbookRelsXml = await zip
        .file('xl/_rels/workbook.xml.rels')
        ?.async('text');
    if (!workbookRelsXml) {
        throw new Error(
            'Invalid .xlsx file: workbook relationships are missing.',
        );
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
            const fromRef = columnLettersFromCellRef(
                cellNode.getAttribute('r'),
            );
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
            !Array.from(headerByColumn.values()).some(
                (value) => value === header,
            ),
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
        status: entry.status,
    };
}

function normalizeImportedStatus(value: string): StudentRegistryStatus | null {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return 'active';
    if (
        normalized === 'active' ||
        normalized === 'true' ||
        normalized === '1' ||
        normalized === 'yes'
    ) {
        return 'active';
    }
    if (
        normalized === 'inactive' ||
        normalized === 'false' ||
        normalized === '0' ||
        normalized === 'no'
    ) {
        return 'inactive';
    }
    return null;
}
function validateImportRows(rows: ParsedStudentRow[]): {
    cleanRows: StudentRegistryUpsertInput[];
    errors: string[];
} {
    const errors: string[] = [];
    const cleanRows: StudentRegistryUpsertInput[] = [];
    const seenUsn = new Set<string>();

    rows.forEach((row) => {
        const usn = (row.values.usn ?? '').trim().toUpperCase();
        const firstName = (row.values.first_name ?? '').trim();
        const lastName = (row.values.last_name ?? '').trim();
        const course = (row.values.course ?? '').trim();
        const yearLevelRaw = (row.values.year_level ?? '').trim();
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
        const normalizedStatus = normalizeImportedStatus(statusRaw);
        if (!normalizedStatus) {
            errors.push(
                `Row ${row.rowNumber}: status must be active/inactive or true/false.`,
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
                errors.push(
                    `Row ${row.rowNumber}: duplicate USN "${usn}" in file.`,
                );
            }
            seenUsn.add(usn);
        }

        cleanRows.push({
            usn,
            firstName,
            lastName,
            course: course || undefined,
            yearLevel: parsedYearLevel,
            status: normalizedStatus ?? 'active',
        });
    });

    return { cleanRows, errors };
}

export default function AdminStudentsPage() {
    const [students, setStudents] = useState<StudentRegistryEntry[]>([]);
    const [status, setStatus] = useState('Loading student registry...');
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState('');
    const [sortField, setSortField] = useState<StudentSortField>('firstName');
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_ROWS_PER_PAGE);

    const [form, setForm] = useState<StudentFormState>(emptyFormState());
    const [editingId, setEditingId] = useState('');
    const [isStudentFormModalOpen, setIsStudentFormModalOpen] = useState(false);
    const [saveBusy, setSaveBusy] = useState(false);
    const studentModalTargetRef = useRef<HTMLElement>(null!);
    const { moveProps: studentModalMoveProps } = useDraggable({
        targetRef: studentModalTargetRef,
        isDisabled: !isStudentFormModalOpen,
    });

    const [importFile, setImportFile] = useState<File | null>(null);
    const [importWorkbook, setImportWorkbook] = useState<ImportWorkbook | null>(
        null,
    );
    const [importBusy, setImportBusy] = useState(false);

    const [deleteTarget, setDeleteTarget] =
        useState<StudentRegistryEntry | null>(null);
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
                (student.course ?? '').toLowerCase().includes(term)
            );
        });
    }, [query, students]);
    const sortedStudents = useMemo(() => {
        const directionMultiplier = sortDirection === 'asc' ? 1 : -1;
        const next = [...filteredStudents];

        next.sort((a, b) => {
            let result = 0;

            if (sortField === 'firstName') {
                result = compareTextValues(a.firstName, b.firstName);
            } else if (sortField === 'lastName') {
                result = compareTextValues(a.lastName, b.lastName);
            } else if (sortField === 'yearLevel') {
                const valueA =
                    typeof a.yearLevel === 'number'
                        ? a.yearLevel
                        : Number.POSITIVE_INFINITY;
                const valueB =
                    typeof b.yearLevel === 'number'
                        ? b.yearLevel
                        : Number.POSITIVE_INFINITY;
                result = valueA - valueB;
            } else if (sortField === 'course') {
                result = compareTextValues(a.course ?? '', b.course ?? '');
            } else if (sortField === 'status') {
                result = compareTextValues(a.status, b.status);
            }

            if (result === 0) {
                result = compareTextValues(a.usn, b.usn);
            }

            return result * directionMultiplier;
        });

        return next;
    }, [filteredStudents, sortDirection, sortField]);

    const totalRows = sortedStudents.length;
    const totalPages = Math.max(1, Math.ceil(totalRows / rowsPerPage));
    const safeCurrentPage = Math.min(currentPage, totalPages);
    const startIndex = (safeCurrentPage - 1) * rowsPerPage;
    const paginatedStudents = sortedStudents.slice(
        startIndex,
        startIndex + rowsPerPage,
    );
    const visiblePageNumbers = getVisiblePageNumbers(
        safeCurrentPage,
        totalPages,
    );
    const visibleStart = totalRows === 0 ? 0 : startIndex + 1;
    const visibleEnd = Math.min(startIndex + rowsPerPage, totalRows);

    useEffect(() => {
        setCurrentPage(1);
    }, [query, rowsPerPage, sortDirection, sortField]);

    useEffect(() => {
        setCurrentPage((previous) =>
            previous > totalPages ? totalPages : previous,
        );
    }, [totalPages]);

    function resetForm() {
        setEditingId('');
        setForm(emptyFormState());
    }

    function openAddStudentModal() {
        resetForm();
        setIsStudentFormModalOpen(true);
    }

    function closeStudentFormModal() {
        if (saveBusy) return;
        setIsStudentFormModalOpen(false);
        resetForm();
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
            setIsStudentFormModalOpen(false);
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
        setIsStudentFormModalOpen(true);
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
    async function onImportFileChange(event: ChangeEvent<HTMLInputElement>) {
        const input = event.target;
        const selectedFile = input.files?.[0] ?? null;
        setImportFile(selectedFile);
        setImportWorkbook(null);

        if (!selectedFile) {
            return;
        }

        try {
            const bytes = await selectedFile.arrayBuffer();
            setImportWorkbook({ name: selectedFile.name, bytes });
        } catch {
            input.value = '';
            setImportFile(null);
            setImportWorkbook(null);
            const message =
                'Unable to read selected file. Copy it to a local folder, close Excel, and select it again.';
            setStatus(message);
            setPopper({ message, tone: 'error' });
        }
    }
    async function onImportStudents() {
        if (importBusy) return;
        if (!importWorkbook) {
            const message = 'Select an .xlsx file first.';
            setStatus(message);
            setPopper({ message, tone: 'error' });
            return;
        }

        setImportBusy(true);
        setStatus('');
        try {
            const parsedRows = await parseStudentXlsx(importWorkbook.bytes);
            if (parsedRows.length === 0) {
                throw new Error(
                    'The uploaded file has no data rows to import.',
                );
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
            setImportWorkbook(null);
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
                <AdminPanelShell>
                    {/* <PageHeader
                        eyebrow='Admin workspace'
                        title='Student Registry'
                        description='Import .xlsx records, search quickly, and edit students with a polished modal workflow.'
                        action={
                            <Button
                                color='primary'
                                onPress={openAddStudentModal}
                                className='rounded-2xl bg-slate-900 px-5 font-semibold text-white shadow-[0_20px_28px_-20px_rgba(15,23,42,0.85)]'
                            >
                                Add Student
                            </Button>
                        }
                    /> */}
                    {status ? (
                        <p className='mb-4 rounded-[22px] border border-slate-200/90 bg-white/70 px-4 py-3 text-sm text-slate-600 shadow-[0_20px_38px_-30px_rgba(15,23,42,0.65)] backdrop-blur-xl'>
                            {status}
                        </p>
                    ) : null}

                    <section className='mb-5 grid gap-4 xl:grid-cols-[1.35fr_0.65fr]'>
                        <motion.article
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.25, ease: 'easeOut' }}
                            className='relative overflow-hidden rounded-[30px] border border-white/75 bg-gradient-to-br from-white/90 via-white/82 to-slate-100/75 p-5 shadow-[0_30px_75px_-45px_rgba(15,23,42,0.6)] backdrop-blur-xl'
                        >
                            <div className='pointer-events-none absolute -right-10 top-0 h-24 w-24 rounded-full bg-sky-200/35 blur-2xl' />
                            <h2 className='text-base font-semibold tracking-tight text-slate-900'>
                                Import from Excel
                            </h2>
                            <div className='mt-4 flex flex-col gap-2 sm:flex-row sm:items-center'>
                                <input
                                    type='file'
                                    accept='.xlsx'
                                    onChange={(event) => {
                                        void onImportFileChange(event);
                                    }}
                                    className='w-full rounded-2xl border border-white/80 bg-white/80 px-3 py-2 text-xs text-slate-700 outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] file:mr-3 file:rounded-xl file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-slate-700'
                                />
                                <button
                                    type='button'
                                    onClick={() => void onImportStudents()}
                                    disabled={importBusy}
                                    className='rounded-2xl bg-sky-600 px-4 py-2 text-xs font-semibold text-white shadow-[0_18px_28px_-20px_rgba(2,132,199,0.9)] transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60'
                                >
                                    {importBusy
                                        ? 'Importing...'
                                        : 'Import .xlsx'}
                                </button>
                            </div>
                            {importFile ? (
                                <p className='mt-2 text-xs text-slate-500'>
                                    Selected:{' '}
                                    {importWorkbook?.name ?? importFile.name}
                                </p>
                            ) : null}
                        </motion.article>

                        <motion.article
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{
                                duration: 0.25,
                                delay: 0.04,
                                ease: 'easeOut',
                            }}
                            className='rounded-[30px] border border-white/75 bg-gradient-to-br from-white/88 via-white/78 to-slate-100/70 p-5 shadow-[0_30px_75px_-45px_rgba(15,23,42,0.6)] backdrop-blur-xl'
                        >
                            <h2 className='text-base font-semibold tracking-tight text-slate-900'>
                                Student Registry
                            </h2>

                            <Button
                                color='primary'
                                onPress={openAddStudentModal}
                                className='mt-4 w-full rounded-2xl bg-slate-900 text-xs font-semibold text-white shadow-[0_20px_26px_-20px_rgba(15,23,42,0.9)]'
                            >
                                Add Student
                            </Button>
                        </motion.article>
                    </section>

                    <motion.section
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                            duration: 0.24,
                            delay: 0.07,
                            ease: 'easeOut',
                        }}
                        className='overflow-hidden rounded-[32px] border border-white/75 bg-white/78 shadow-[0_35px_90px_-55px_rgba(15,23,42,0.72)] backdrop-blur-xl'
                    >
                        <div className='border-b border-white/70 bg-white/45 p-4 backdrop-blur'>
                            <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
                                <p className='text-sm font-semibold text-slate-800'>
                                    Students: {filteredStudents.length}
                                    {query.trim()
                                        ? ` / ${students.length}`
                                        : ''}
                                </p>
                                <div className='flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center'>
                                    <input
                                        value={query}
                                        onChange={(event) =>
                                            setQuery(event.target.value)
                                        }
                                        placeholder='Search by USN, name, course'
                                        className='w-full rounded-2xl border border-white/80 bg-white/75 px-3 py-2 text-xs text-slate-700 outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] transition focus:border-sky-300 sm:max-w-sm'
                                    />
                                    <select
                                        value={sortField}
                                        onChange={(event) =>
                                            setSortField(
                                                event.target
                                                    .value as StudentSortField,
                                            )
                                        }
                                        className='rounded-2xl border border-white/80 bg-white/75 px-3 py-2 text-xs text-slate-700 outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] transition focus:border-sky-300'
                                    >
                                        {STUDENT_SORT_OPTIONS.map((option) => (
                                            <option
                                                key={option.value}
                                                value={option.value}
                                            >
                                                Sort: {option.label}
                                            </option>
                                        ))}
                                    </select>
                                    <select
                                        value={sortDirection}
                                        onChange={(event) =>
                                            setSortDirection(
                                                event.target
                                                    .value as SortDirection,
                                            )
                                        }
                                        className='rounded-2xl border border-white/80 bg-white/75 px-3 py-2 text-xs text-slate-700 outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] transition focus:border-sky-300'
                                    >
                                        <option value='asc'>Asc</option>
                                        <option value='desc'>Desc</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className='overflow-x-auto'>
                            <table className='w-full min-w-[860px] text-left text-sm'>
                                <thead className='bg-white/70 text-[11px] uppercase tracking-[0.12em] text-slate-500'>
                                    <tr>
                                        <th className='px-4 py-3'>USN</th>
                                        <th className='px-4 py-3'>Name</th>
                                        <th className='px-4 py-3'>Course</th>
                                        <th className='px-4 py-3'>Year</th>
                                        <th className='px-4 py-3'>Status</th>
                                        <th className='px-4 py-3'>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr>
                                            <td
                                                colSpan={6}
                                                className='px-4 py-8 text-center text-slate-500'
                                            >
                                                Loading...
                                            </td>
                                        </tr>
                                    ) : filteredStudents.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan={6}
                                                className='px-4 py-8 text-center text-slate-500'
                                            >
                                                No student rows found.
                                            </td>
                                        </tr>
                                    ) : (
                                        paginatedStudents.map(
                                            (student, studentIndex) => (
                                                <motion.tr
                                                    key={student.id}
                                                    initial={{
                                                        opacity: 0,
                                                        y: 8,
                                                    }}
                                                    animate={{
                                                        opacity: 1,
                                                        y: 0,
                                                    }}
                                                    transition={{
                                                        duration: 0.18,
                                                        delay:
                                                            studentIndex *
                                                            0.012,
                                                        ease: 'easeOut',
                                                    }}
                                                    className='border-t border-white/80 transition-colors hover:bg-white/55'
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
                                                        {student.yearLevel ??
                                                            '-'}
                                                    </td>
                                                    <td className='px-4 py-3'>
                                                        <span
                                                            className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                                                                student.status ===
                                                                'active'
                                                                    ? 'border border-emerald-200 bg-emerald-100/80 text-emerald-700'
                                                                    : 'border border-slate-200 bg-slate-100/80 text-slate-600'
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
                                                                    onEditStudent(
                                                                        student,
                                                                    )
                                                                }
                                                                className='rounded-xl border border-white/85 bg-white/85 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-[0_16px_24px_-20px_rgba(15,23,42,0.8)] transition hover:bg-white'
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
                                                                className='rounded-xl border border-rose-200/80 bg-rose-50/85 px-3 py-1.5 text-xs font-semibold text-rose-700 shadow-[0_16px_24px_-20px_rgba(244,63,94,0.75)] transition hover:bg-rose-100'
                                                            >
                                                                Delete
                                                            </button>
                                                        </div>
                                                    </td>
                                                </motion.tr>
                                            ),
                                        )
                                    )}
                                </tbody>
                            </table>
                        </div>
                        {!loading && filteredStudents.length > 0 ? (
                            <div className='flex flex-col gap-3 border-t border-white/70 bg-white/45 p-4 sm:flex-row sm:items-center sm:justify-between'>
                                <p className='text-xs text-slate-500'>
                                    Showing {visibleStart}-{visibleEnd} of{' '}
                                    {filteredStudents.length}
                                </p>
                                <div className='flex flex-wrap items-center gap-2'>
                                    <label
                                        htmlFor='students-rows-per-page'
                                        className='text-xs font-medium text-slate-600'
                                    >
                                        Rows per page
                                    </label>
                                    <input
                                        id='students-rows-per-page'
                                        type='number'
                                        min={1}
                                        value={rowsPerPage}
                                        onChange={(event) => {
                                            const value = Number(
                                                event.target.value,
                                            );
                                            if (
                                                !Number.isFinite(value) ||
                                                value < 1
                                            ) {
                                                return;
                                            }
                                            setRowsPerPage(
                                                Math.min(
                                                    500,
                                                    Math.trunc(value),
                                                ),
                                            );
                                        }}
                                        className='w-20 rounded-xl border border-white/85 bg-white/80 px-2 py-1 text-xs text-slate-700 outline-none focus:border-sky-300'
                                    />
                                    <button
                                        type='button'
                                        onClick={() =>
                                            setCurrentPage(safeCurrentPage - 1)
                                        }
                                        disabled={safeCurrentPage <= 1}
                                        className='rounded-xl border border-white/85 bg-white/85 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60'
                                    >
                                        Previous
                                    </button>
                                    {visiblePageNumbers[0] > 1 ? (
                                        <>
                                            <button
                                                type='button'
                                                onClick={() =>
                                                    setCurrentPage(1)
                                                }
                                                className='rounded-xl border border-white/85 bg-white/85 px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:bg-white'
                                            >
                                                1
                                            </button>
                                            <span className='px-1 text-xs text-slate-400'>
                                                ...
                                            </span>
                                        </>
                                    ) : null}
                                    {visiblePageNumbers.map((pageNumber) => (
                                        <button
                                            key={pageNumber}
                                            type='button'
                                            onClick={() =>
                                                setCurrentPage(pageNumber)
                                            }
                                            className={`rounded-xl px-2.5 py-1 text-xs font-semibold transition ${
                                                pageNumber === safeCurrentPage
                                                    ? 'border border-sky-200 bg-sky-100/80 text-sky-700'
                                                    : 'border border-white/85 bg-white/85 text-slate-700 hover:bg-white'
                                            }`}
                                        >
                                            {pageNumber}
                                        </button>
                                    ))}
                                    {visiblePageNumbers[
                                        visiblePageNumbers.length - 1
                                    ] < totalPages ? (
                                        <>
                                            <span className='px-1 text-xs text-slate-400'>
                                                ...
                                            </span>
                                            <button
                                                type='button'
                                                onClick={() =>
                                                    setCurrentPage(totalPages)
                                                }
                                                className='rounded-xl border border-white/85 bg-white/85 px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:bg-white'
                                            >
                                                {totalPages}
                                            </button>
                                        </>
                                    ) : null}
                                    <button
                                        type='button'
                                        onClick={() =>
                                            setCurrentPage(safeCurrentPage + 1)
                                        }
                                        disabled={safeCurrentPage >= totalPages}
                                        className='rounded-xl border border-white/85 bg-white/85 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60'
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        ) : null}
                    </motion.section>

                    <Modal
                        ref={studentModalTargetRef}
                        isOpen={isStudentFormModalOpen}
                        backdrop='opaque'
                        classNames={{
                            backdrop:
                                'bg-linear-to-t from-zinc-900 to-zinc-900/10 backdrop-opacity-20',
                        }}
                        size='2xl'
                        isDismissable={!saveBusy}
                        isKeyboardDismissDisabled={saveBusy}
                        hideCloseButton
                        onClose={closeStudentFormModal}
                    >
                        <ModalContent className='overflow-hidden rounded-[30px] border border-white/80 bg-gradient-to-br from-white/95 via-white/90 to-slate-100/85 shadow-[0_35px_80px_-45px_rgba(15,23,42,0.55)] backdrop-blur-2xl'>
                            <ModalHeader
                                {...studentModalMoveProps}
                                className='cursor-grab select-none px-5 pb-2 pt-5 active:cursor-grabbing'
                            >
                                <motion.div
                                    initial={{ opacity: 0, y: 6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{
                                        duration: 0.2,
                                        ease: 'easeOut',
                                    }}
                                >
                                    <p className='text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500'>
                                        Student Registry
                                    </p>
                                    <h2 className='text-base font-semibold text-slate-900'>
                                        {editingId
                                            ? 'Edit Student'
                                            : 'Add Student'}
                                    </h2>
                                </motion.div>
                            </ModalHeader>
                            <ModalBody className='px-5 py-2'>
                                <div className='grid gap-3 sm:grid-cols-2'>
                                    <Input
                                        value={form.usn}
                                        onChange={(event) =>
                                            setForm((previous) => ({
                                                ...previous,
                                                usn: event.target.value,
                                            }))
                                        }
                                        placeholder='USN'
                                        variant='bordered'
                                        isDisabled={saveBusy}
                                        classNames={
                                            STUDENT_MODAL_INPUT_CLASS_NAMES
                                        }
                                    />
                                    <Input
                                        value={form.firstName}
                                        onChange={(event) =>
                                            setForm((previous) => ({
                                                ...previous,
                                                firstName: event.target.value,
                                            }))
                                        }
                                        placeholder='First name'
                                        variant='bordered'
                                        isDisabled={saveBusy}
                                        classNames={
                                            STUDENT_MODAL_INPUT_CLASS_NAMES
                                        }
                                    />
                                    <Input
                                        value={form.lastName}
                                        onChange={(event) =>
                                            setForm((previous) => ({
                                                ...previous,
                                                lastName: event.target.value,
                                            }))
                                        }
                                        placeholder='Last name'
                                        variant='bordered'
                                        isDisabled={saveBusy}
                                        classNames={
                                            STUDENT_MODAL_INPUT_CLASS_NAMES
                                        }
                                    />
                                    <Input
                                        value={form.course}
                                        onChange={(event) =>
                                            setForm((previous) => ({
                                                ...previous,
                                                course: event.target.value,
                                            }))
                                        }
                                        placeholder='Course'
                                        variant='bordered'
                                        isDisabled={saveBusy}
                                        classNames={
                                            STUDENT_MODAL_INPUT_CLASS_NAMES
                                        }
                                    />
                                    <Input
                                        value={form.yearLevel}
                                        onChange={(event) =>
                                            setForm((previous) => ({
                                                ...previous,
                                                yearLevel: event.target.value,
                                            }))
                                        }
                                        placeholder='Year level'
                                        variant='bordered'
                                        isDisabled={saveBusy}
                                        classNames={
                                            STUDENT_MODAL_INPUT_CLASS_NAMES
                                        }
                                    />
                                    <div className='space-y-1'>
                                        <p className='pl-1 text-xs font-semibold tracking-[0.03em] text-slate-600'>
                                            Status
                                        </p>
                                        <select
                                            value={form.status}
                                            onChange={(event) =>
                                                setForm((previous) => ({
                                                    ...previous,
                                                    status: event.target
                                                        .value as StudentRegistryStatus,
                                                }))
                                            }
                                            disabled={saveBusy}
                                            className='w-full rounded-2xl border border-white/80 bg-white/90 px-3 py-2 text-sm text-slate-700 outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] transition focus:border-sky-300 disabled:cursor-not-allowed disabled:opacity-60'
                                        >
                                            <option value='active'>
                                                Active
                                            </option>
                                            <option value='inactive'>
                                                Inactive
                                            </option>
                                        </select>
                                    </div>
                                </div>
                            </ModalBody>
                            <ModalFooter className='px-5 pb-5 pt-4'>
                                <Button
                                    variant='bordered'
                                    isDisabled={saveBusy}
                                    onPress={closeStudentFormModal}
                                    className='rounded-2xl border border-white/80 bg-white/75 font-semibold text-slate-700'
                                >
                                    Cancel
                                </Button>
                                <Button
                                    color='primary'
                                    isDisabled={saveBusy}
                                    onPress={() => void onSaveStudent()}
                                    className='rounded-2xl bg-slate-900 font-semibold text-white'
                                >
                                    {saveBusy
                                        ? 'Saving...'
                                        : editingId
                                          ? 'Update Student'
                                          : 'Save Student'}
                                </Button>
                            </ModalFooter>
                        </ModalContent>
                    </Modal>

                    <ConfirmDialog
                        open={Boolean(deleteTarget)}
                        title='Delete this student row?'
                        description='This action permanently removes this registry entry.'
                        confirmLabel='Delete'
                        busy={deleteBusy}
                        classNames='rounded-[30px] border border-white/80 bg-gradient-to-br from-white/95 via-white/90 to-slate-100/85 shadow-[0_35px_80px_-45px_rgba(15,23,42,0.55)] backdrop-blur-2xl'
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
                </AdminPanelShell>
            </AppShell>
        </AuthGuard>
    );
}
