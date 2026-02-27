const TIMESTAMP_PATTERN =
    /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?)?(?:([zZ])|([+-]\d{2})(?::?(\d{2}))?)?$/;

export function parseTimestamp(value: string): Date {
    const raw = value.trim();
    if (!raw) return new Date(NaN);

    const withIsoSeparator = raw.includes('T') ? raw : raw.replace(' ', 'T');
    const offsetMatch = withIsoSeparator.match(/([+-]\d{2})(?::?(\d{2}))?$/);
    let normalized = withIsoSeparator;

    if (offsetMatch) {
        const hourPart = offsetMatch[1];
        const minutePart = offsetMatch[2] ?? '00';
        const normalizedOffset = `${hourPart}:${minutePart}`;
        normalized = withIsoSeparator.replace(
            /([+-]\d{2})(?::?(\d{2}))?$/,
            normalizedOffset,
        );
    } else if (!/[zZ]$/.test(withIsoSeparator)) {
        normalized = `${withIsoSeparator}Z`;
    }

    const parsed = new Date(normalized);
    if (!Number.isNaN(parsed.getTime())) return parsed;

    const match = raw.match(TIMESTAMP_PATTERN);
    if (!match) return new Date(NaN);

    const [
        ,
        yearRaw,
        monthRaw,
        dayRaw,
        hourRaw = '00',
        minuteRaw = '00',
        secondRaw = '00',
        fractionalRaw = '0',
        zFlag,
        offsetHourRaw,
        offsetMinuteRaw = '00',
    ] = match;

    const year = Number(yearRaw);
    const month = Number(monthRaw);
    const day = Number(dayRaw);
    const hour = Number(hourRaw);
    const minute = Number(minuteRaw);
    const second = Number(secondRaw);
    const millisecond = Number(
        `${fractionalRaw}`.padEnd(3, '0').slice(0, 3),
    );

    const hasInvalidNumber = [
        year,
        month,
        day,
        hour,
        minute,
        second,
        millisecond,
    ].some((num) => Number.isNaN(num));
    if (hasInvalidNumber) return new Date(NaN);

    const localUtcMs = Date.UTC(
        year,
        month - 1,
        day,
        hour,
        minute,
        second,
        millisecond,
    );
    const strictDate = new Date(localUtcMs);
    if (
        strictDate.getUTCFullYear() !== year ||
        strictDate.getUTCMonth() !== month - 1 ||
        strictDate.getUTCDate() !== day ||
        strictDate.getUTCHours() !== hour ||
        strictDate.getUTCMinutes() !== minute ||
        strictDate.getUTCSeconds() !== second
    ) {
        return new Date(NaN);
    }

    if (zFlag) {
        return new Date(localUtcMs);
    }

    if (offsetHourRaw) {
        const sign = offsetHourRaw.startsWith('-') ? -1 : 1;
        const offsetHours = Math.abs(Number(offsetHourRaw));
        const offsetMinutes = Number(offsetMinuteRaw);
        if (
            Number.isNaN(offsetHours) ||
            Number.isNaN(offsetMinutes) ||
            offsetMinutes < 0 ||
            offsetMinutes > 59
        ) {
            return new Date(NaN);
        }
        const totalOffsetMinutes = offsetHours * 60 + offsetMinutes;
        const utcMs = localUtcMs - sign * totalOffsetMinutes * 60_000;
        return new Date(utcMs);
    }

    return new Date(localUtcMs);
}
