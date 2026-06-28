import type { ComponentType, ReactNode } from "react";

import type { CrudFilter, CrudSort, ListPagePagination } from "../headless/types";

export type ApitoLinkProps = {
  to: string;
  children?: ReactNode;
  className?: string;
  replace?: boolean;
};

export type ApitoLinkComponent = ComponentType<ApitoLinkProps>;

export type ApitoButtonBaseProps = {
  children?: ReactNode;
  hideText?: boolean;
  size?: "small" | "middle" | "large";
  loading?: boolean;
  disabled?: boolean;
  className?: string;
};

export type ApitoCreateButtonProps = ApitoButtonBaseProps & {
  resource?: string;
  to?: string;
  createRoute?: string;
};

export type ApitoEditButtonProps = ApitoButtonBaseProps & {
  resource?: string;
  recordItemId?: string;
  to?: string;
  editRoute?: string;
};

export type ApitoShowButtonProps = ApitoButtonBaseProps & {
  resource?: string;
  recordItemId?: string;
  to?: string;
  showRoute?: string;
};

export type ApitoSaveButtonProps = ApitoButtonBaseProps & {
  htmlType?: "submit" | "button" | "reset";
  type?: "primary" | "default" | "dashed" | "link" | "text";
};

export type ApitoHeaderButtonsContext = {
  defaultButtons: ReactNode;
  createButtonProps?: ApitoCreateButtonProps;
};

export type ApitoFormHeaderButtonsContext = {
  defaultButtons: ReactNode;
};

export type ApitoRowActionsContext<TModel> = {
  record: TModel;
  defaultActions: ReactNode;
};

export type ApitoColumnDef<TModel> = {
  key: string;
  title: ReactNode;
  dataIndex?: keyof TModel | string | string[];
  render?: (value: unknown, record: TModel, index: number) => ReactNode;
  sorter?: boolean;
  width?: number | string;
  align?: "left" | "center" | "right";
};

export type ApitoListAction<TModel> = {
  key: string;
  label: ReactNode;
  onClick: (record: TModel) => void;
  danger?: boolean;
};

export type ApitoListProps<TModel> = {
  title?: ReactNode;
  resource: string;
  columns: ApitoColumnDef<TModel>[];
  dataSource: TModel[];
  total?: number;
  loading?: boolean;
  pagination?: ListPagePagination;
  onPaginationChange?: (pagination: ListPagePagination) => void;
  filters?: CrudFilter[];
  onFiltersChange?: (filters: CrudFilter[]) => void;
  sorters?: CrudSort[];
  onSortersChange?: (sorters: CrudSort[]) => void;
  rowKey?: keyof TModel | ((record: TModel) => string);
  actions?: ApitoListAction<TModel>[];
  /** When set and canCreate !== false, renders default Create button unless headerButtons overrides */
  createRoute?: string;
  editRoute?: string;
  showRoute?: string;
  canCreate?: boolean;
  canEdit?: boolean;
  canShow?: boolean;
  hideDefaultRowActions?: boolean;
  headerButtons?:
    | ReactNode
    | ((ctx: ApitoHeaderButtonsContext) => ReactNode);
  rowActions?:
    | ReactNode
    | ((ctx: ApitoRowActionsContext<TModel>) => ReactNode);
  /** Extra toolbar (filters UI) above the table */
  toolbar?: ReactNode;
  linkComponent?: ApitoLinkComponent;
};

export type ApitoFormProps<TModel = Record<string, unknown>> = {
  title?: ReactNode;
  resource: string;
  initialValues?: Partial<TModel>;
  loading?: boolean;
  saving?: boolean;
  onFinish: (values: TModel) => void | Promise<void>;
  children: ReactNode;
  footer?: ReactNode;
  footerButtons?: ReactNode;
  breadcrumb?: ReactNode;
  saveButtonProps?: ApitoSaveButtonProps;
  headerButtons?:
    | ReactNode
    | ((ctx: ApitoFormHeaderButtonsContext) => ReactNode);
};

export type ApitoCreateProps<TModel = Record<string, unknown>> =
  ApitoFormProps<TModel>;

export type ApitoEditProps<TModel = Record<string, unknown>> =
  ApitoFormProps<TModel> & {
    id?: string;
  };

export type ApitoShowProps<TModel> = {
  title?: ReactNode;
  resource: string;
  record?: TModel;
  loading?: boolean;
  children: ReactNode;
  headerButtons?:
    | ReactNode
    | ((ctx: ApitoFormHeaderButtonsContext) => ReactNode);
  breadcrumb?: ReactNode;
};

export type ApitoDeleteButtonProps = {
  resource: string;
  recordItemId: string;
  onSuccess?: () => void;
  confirmTitle?: ReactNode;
  confirmMessage?: ReactNode;
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
};

export type ApitoResourceLayoutProps = {
  title?: ReactNode;
  breadcrumb?: ReactNode;
  headerButtons?: ReactNode;
  children: ReactNode;
};
