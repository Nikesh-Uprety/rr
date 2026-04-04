import * as React from "react";
import MuiTablePagination from "@mui/material/TablePagination";
import { styled } from "@mui/material/styles";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  pageSize?: number;
  onPageSizeChange?: (pageSize: number) => void;
}

const StyledTablePagination = styled(MuiTablePagination)(({ theme }) => ({
  color: theme.palette.text.primary,
  backgroundColor: theme.palette.background.paper,
  borderTop: `1px solid ${theme.palette.divider}`,
  "& .MuiTablePagination-toolbar": {
    minHeight: 48,
    paddingLeft: 8,
    paddingRight: 8,
  },
  "& .MuiTablePagination-select": {
    paddingLeft: 8,
    paddingRight: 24,
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 500,
  },
  "& .MuiTablePagination-selectLabel": {
    fontSize: 12,
    fontWeight: 500,
    color: theme.palette.text.secondary,
    opacity: 0.7,
  },
  "& .MuiTablePagination-displayedRows": {
    fontSize: 12,
    fontWeight: 500,
    color: theme.palette.text.secondary,
  },
  "& .MuiTablePagination-actions": {
    marginLeft: 4,
  },
  "& .MuiIconButton-root": {
    padding: 4,
    borderRadius: 6,
    color: theme.palette.text.primary,
  },
  "& .MuiIconButton-root.Mui-disabled": {
    color: theme.palette.text.disabled,
  },
  "& .MuiSelect-select": {
    display: "flex",
    alignItems: "center",
    color: theme.palette.text.primary,
  },
}));

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  totalItems = 0,
  pageSize = 15,
  onPageSizeChange,
}: PaginationProps) {
  if (totalItems === 0) return null;

  const [rowsPerPage, setRowsPerPage] = React.useState(pageSize);

  const handlePageChange = (
    _event: React.MouseEvent<HTMLButtonElement> | null,
    newPage: number,
  ) => {
    onPageChange(newPage + 1);
  };

  const handleRowsPerPageChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const newSize = parseInt(event.target.value, 10);
    setRowsPerPage(newSize);
    onPageChange(1);
    onPageSizeChange?.(newSize);
  };

  return (
    <StyledTablePagination
      count={totalItems}
      page={currentPage - 1}
      onPageChange={handlePageChange}
      rowsPerPage={rowsPerPage}
      onRowsPerPageChange={handleRowsPerPageChange}
      rowsPerPageOptions={[10, 15, 20, 25, 50, 100]}
      labelRowsPerPage="Per page"
      labelDisplayedRows={({ from, to, count }) =>
        `${from}–${to} of ${count !== -1 ? count : `more than ${to}`}`
      }
    />
  );
}
