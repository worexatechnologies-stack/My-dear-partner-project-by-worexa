'use client';

import React from 'react';

interface TableProps extends React.HTMLAttributes<HTMLTableElement> {
  children: React.ReactNode;
  stickyHeader?: boolean;
}

export const Table: React.FC<TableProps> = ({
  children,
  stickyHeader = false,
  className = '',
  ...props
}) => {
  return (
    <div className="w-full overflow-x-auto rounded-2xl border border-gray-100 shadow-sm bg-white">
      <table className={`w-full text-left border-collapse text-sm ${className}`} {...props}>
        {children}
      </table>
    </div>
  );
};

export const TableHeader: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({ children, className = '', ...props }) => (
  <thead className={`bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider ${className}`} {...props}>
    {children}
  </thead>
);

export const TableBody: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({ children, className = '', ...props }) => (
  <tbody className={`divide-y divide-gray-100 bg-white ${className}`} {...props}>
    {children}
  </tbody>
);

interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  hoverable?: boolean;
}

export const TableRow: React.FC<TableRowProps> = ({
  children,
  hoverable = true,
  className = '',
  ...props
}) => {
  return (
    <tr 
      className={`
        transition-colors duration-150
        ${hoverable ? 'hover:bg-gray-50/50' : ''}
        ${className}
      `} 
      {...props}
    >
      {children}
    </tr>
  );
};

export const TableCell: React.FC<React.TdHTMLAttributes<HTMLTableCellElement>> = ({ children, className = '', ...props }) => (
  <td className={`px-6 py-4 text-gray-700 align-middle ${className}`} {...props}>
    {children}
  </td>
);

export const TableHeadCell: React.FC<React.ThHTMLAttributes<HTMLTableCellElement>> = ({ children, className = '', ...props }) => (
  <th className={`px-6 py-4 font-bold align-middle select-none ${className}`} {...props}>
    {children}
  </th>
);
