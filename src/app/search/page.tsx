import { SearchPageClient } from '@/components/search/search-page-client';

type SearchPageProps = {
    searchParams?: Promise<{
        q?: string;
    }>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
    const resolved = (await searchParams) ?? {};
    const query = typeof resolved.q === 'string' ? resolved.q : '';
    return <SearchPageClient query={query} />;
}
