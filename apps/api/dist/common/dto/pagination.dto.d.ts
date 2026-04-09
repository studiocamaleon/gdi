export declare class PaginationDto {
    page: number;
    limit: number;
    get skip(): number;
}
export declare function paginatedResponse<T>(data: T[], total: number, pagination: PaginationDto): {
    data: T[];
    total: number;
    page: number;
    limit: number;
    pages: number;
};
