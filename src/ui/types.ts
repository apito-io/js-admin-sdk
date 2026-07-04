import type { ComponentType, ReactNode } from "react";

import type {
  ApitoExportConfig,
  ApitoImportConfig,
  ApitoImportRowsContext,
  ApitoValidatedImportRow,
} from "../headless/importExport";
import type { ApitoFetcher } from "../headless/fetcher";
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

export type ApitoTableRowActionsProps = {
  resource: string;
  recordItemId: string;
  canEdit?: boolean;
  canShow?: boolean;
  canDelete?: boolean;
  hideText?: boolean;
  size?: "small" | "middle" | "large";
  editTo?: string;
  showTo?: string;
  editRoute?: string;
  showRoute?: string;
  onDelete?: () => void | Promise<void>;
  deleteLoading?: boolean;
  confirmTitle?: ReactNode;
  confirmMessage?: ReactNode;
  extra?: ReactNode;
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
  /** Ant Table dataIndex key → Apito GraphQL sort field */
  sortFieldMap?: Record<string, string>;
  rowKey?: keyof TModel | ((record: TModel) => string);
  actions?: ApitoListAction<TModel>[];
  /** When set and canCreate !== false, renders default Create button unless headerButtons overrides */
  createRoute?: string;
  editRoute?: string;
  showRoute?: string;
  canCreate?: boolean;
  canEdit?: boolean;
  canShow?: boolean;
  canDelete?: boolean;
  onDeleteRecord?: (id: string) => void | Promise<void>;
  deleteLoading?: boolean;
  deleteConfirmTitle?: ReactNode;
  deleteConfirmMessage?: ReactNode;
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
  importConfig?: ApitoImportConfig;
  exportConfig?: ApitoExportConfig;
  /** Pass from app when using importConfig (avoids duplicate SDK context in linked UI package) */
  fetcher?: ApitoFetcher;
  importCreateDocument?: unknown;
  importUpdateDocument?: unknown;
  onImported?: () => void;
  onExportRecords?: () => Promise<Array<Record<string, unknown>>>;
};

export type ApitoImportButtonProps = {
  resource: string;
  config: ApitoImportConfig;
  /** Required when UI package resolves a different SDK copy than the app provider */
  fetcher: ApitoFetcher;
  createDocument?: unknown;
  updateDocument?: unknown;
  onImported?: () => void;
  onImportRows?: (
    rows: ApitoValidatedImportRow[],
    context: ApitoImportRowsContext,
  ) => Promise<void>;
  children?: ReactNode;
  loading?: boolean;
  disabled?: boolean;
};

export type ApitoExportButtonProps = {
  resource: string;
  config: ApitoExportConfig;
  onExportRecords: () => Promise<Array<Record<string, unknown>>>;
  children?: ReactNode;
  loading?: boolean;
  disabled?: boolean;
};

export type ApitoImportModalProps = {
  open: boolean;
  onClose: () => void;
  config: ApitoImportConfig;
  fetcher: ApitoFetcher;
  createDocument?: unknown;
  updateDocument?: unknown;
  onImported?: () => void;
  /** When set, bypasses default per-row GraphQL import (domain batch importers) */
  onImportRows?: (
    rows: ApitoValidatedImportRow[],
    context: ApitoImportRowsContext,
  ) => Promise<void>;
};

export type ApitoMediaUploadResult = {
  public_url: string;
  file_id: string;
};

export type ApitoMediaUploadFileType = "media" | "pdf" | "document" | "other";

export type ApitoMediaFileKind = "image" | "pdf" | "document" | "other";

/** App-injected upload (e.g. same-origin route → SDK `uploadFile`). */
export type ApitoMediaUploader = (
  file: File,
  options?: {
    onProgress?: (percent: number) => void;
    fileType?: ApitoMediaUploadFileType;
  },
) => Promise<ApitoMediaUploadResult>;

export type ApitoMediaDeleter = (
  ids: string[],
  options?: { urls?: string[] },
) => Promise<unknown>;

export type ApitoMediaFileResolver = (url: string) => Promise<string | null>;

/** Wired upload components read this from {@link ApitoProvider} or {@link ApitoMediaProvider}. */
export type ApitoMediaConfig = {
  uploadMedia: ApitoMediaUploader;
  deleteMedia?: ApitoMediaDeleter;
  resolveFileId?: ApitoMediaFileResolver;
  imageUploadLabels?: Partial<ApitoImageUploadLabels>;
  galleryUploaderLabels?: Partial<ApitoGalleryUploaderLabels>;
};

export type ApitoImageUploadLabels = {
  onlyImages: string;
  fileTooLarge: string;
  uploadFailed: string;
  imageUploaded: string;
  uploadFailedFallback: string;
  clickToUpload: string;
  camera: string;
  gallery: string;
  uploading: string;
  change: string;
  cropImage: string;
  upload: string;
  cancel: string;
  select: string;
  capture: string;
  cameraAccess: string;
};

export type ApitoGalleryUploaderLabels = {
  title: string;
  addImage: string;
  preview: string;
  maxImagesReached: string;
  imageDeleted: string;
  deleteFailed: string;
  invalidFileType?: string;
  uploadFailed?: string;
};

export type ApitoImageUploadProps = {
  value?: string;
  onChange?: (value: string) => void;
  onUploadSuccess?: (
    result: ApitoMediaUploadResult & {
      uploaderId?: string;
      image_type?: string;
      image_name?: string;
      filename?: string;
      success?: boolean;
    },
  ) => void;
  /** Injected from app — avoids duplicate SDK context in linked UI package */
  uploadMedia: ApitoMediaUploader;
  labels?: Partial<ApitoImageUploadLabels>;
  maxSize?: number;
  aspect?: number;
  quality?: number;
  maxWidth?: number;
  maxHeight?: number;
  circularCrop?: boolean;
  uploadText?: string;
  imageType?: string;
  imageName?: string;
  showCamera?: boolean;
  displayWidth?: string | number;
  displayHeight?: string | number;
  previewSize?: "small" | "medium" | "large";
  uploaderId?: string;
  /** HTML accept attribute. Default `image/*`. */
  accept?: string;
  /** Shorthand when `accept` is omitted */
  acceptKinds?: ApitoMediaFileKind[];
  /** Apito files API category. Inferred from file when omitted. */
  fileType?: ApitoMediaUploadFileType;
  /** When false, skip image-only validation (use with broader `accept`). */
  imagesOnly?: boolean;
};

export type ApitoGalleryUploaderProps = {
  value?: string[];
  onChange?: (value: string[]) => void;
  uploadMedia: ApitoMediaUploader;
  deleteMedia: ApitoMediaDeleter;
  resolveFileId?: ApitoMediaFileResolver;
  labels?: Partial<ApitoGalleryUploaderLabels>;
  maxImages?: number;
  uploadText?: string;
  imageType?: string;
  imageName?: string;
  /** HTML accept attribute. Default `image/*` (gallery images). */
  accept?: string;
  /** Shorthand when `accept` is omitted, e.g. `['image','pdf']` for notice attachments. */
  acceptKinds?: ApitoMediaFileKind[];
  /** Default upload category when not inferred per file. */
  fileType?: ApitoMediaUploadFileType;
  maxSizeMb?: number;
  onUploadSuccess?: (result: ApitoMediaUploadResult & Record<string, unknown>) => void;
  onDeleteSuccess?: (deletedUrl: string, response: unknown) => void;
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

/** Bridge from generated `useListPage` / `useStudentList` into AntD table hooks. */
export type ApitoListPageBridge<TRecord = Record<string, unknown>> = {
  dataSource: TRecord[];
  total: number;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  filters: CrudFilter[];
  setFilters: (filters: CrudFilter[]) => void;
  sorters: CrudSort[];
  setSorters: (sorters: CrudSort[]) => void;
  pagination: ListPagePagination;
  setPagination: (pagination: ListPagePagination) => void;
  refetch: () => void;
};

export type UseApitoTableOptions<TRecord = Record<string, unknown>> = {
  list: ApitoListPageBridge<TRecord>;
  /** Map search form values to SDK CrudFilter[] (include relationEqFilter as needed). */
  mapSearchToFilters?: (
    values: Record<string, unknown>,
  ) => CrudFilter[] | Promise<CrudFilter[]>;
  permanentFilters?: CrudFilter[];
  /** Ant Table dataIndex key → Apito GraphQL sort field */
  sortFieldMap?: Record<string, string>;
  syncWithLocation?: boolean;
  getLocationSearch?: () => Record<string, string>;
  setLocationSearch?: (values: Record<string, string>) => void;
};

export type UseApitoTableResult<TRecord = Record<string, unknown>> = {
  tableProps: {
    dataSource: TRecord[];
    loading: boolean;
    pagination: {
      current: number;
      pageSize: number;
      total: number;
      onChange: (page: number, pageSize: number) => void;
    };
    onChange: (
      pagination: { current?: number; pageSize?: number },
      _filters: unknown,
      sorter: unknown,
    ) => void;
  };
  searchFormProps: {
    form: unknown;
    onFinish: (values: Record<string, unknown>) => void | Promise<void>;
  };
  filters: CrudFilter[];
  setFilters: (filters: CrudFilter[]) => void;
  sorters: CrudSort[];
  setSorters: (sorters: CrudSort[]) => void;
  tableQuery: {
    data: { data: TRecord[]; total: number };
    isLoading: boolean;
    isFetching: boolean;
    refetch: () => void;
    error: Error | null;
  };
  /** Apply sortOrder to column defs for controlled server-side sorting */
  withServerSortOrder: <TCol extends { key?: string; dataIndex?: unknown; sorter?: unknown }>(
    columns: TCol[],
  ) => TCol[];
};

export type ApitoResourceRouteMap = {
  name: string;
  list?: string;
  create?: string;
  edit?: string;
  show?: string;
};

export type ApitoRouterAdapter = {
  Link: ApitoLinkComponent;
  navigate: (to: string, options?: { replace?: boolean }) => void;
};

export type ApitoCrudResourceAction = "list" | "create" | "edit" | "show";
