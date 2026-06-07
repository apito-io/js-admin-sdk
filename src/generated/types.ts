/**
 * AUTO-GENERATED placeholder — run `npm run gen` to regenerate from schema + operations.
 * Types for secured-endpoint loan operations (aligned with flutter_admin_sdk).
 */
export type Maybe<T> = T | null;

export type Scalars = {
  String: string;
  Int: number;
  Boolean: boolean;
};

export type LoanList_Input_Where_Payload = Record<string, unknown>;
export type Loan_List_Count_Input_Where_Payload = Record<string, unknown>;
export type LoanList_Input_Sort_Payload = Record<string, unknown>;
export type Loan_Connection_Filter_Condition = string;
export type Loan_Create_Payload = Record<string, unknown>;
export type Loan_Update_Payload = Record<string, unknown>;
export type Loan_Relation_Connect_Payload = Record<string, unknown>;
export type Loan_Relation_Disconnect_Payload = Record<string, unknown>;

export type GetLoanListQueryVariables = {
  connection?: Maybe<Loan_Connection_Filter_Condition>;
  where?: Maybe<LoanList_Input_Where_Payload>;
  whereCount?: Maybe<Loan_List_Count_Input_Where_Payload>;
  sort?: Maybe<LoanList_Input_Sort_Payload>;
  page?: Maybe<Scalars['Int']>;
  limit?: Maybe<Scalars['Int']>;
};

export type GetLoanListQuery = {
  loanList: Array<{
    id: Scalars['String'];
    data: Record<string, unknown>;
    meta: { created_at: string; status: string; updated_at: string };
  }>;
  loanListCount: { total: Scalars['Int'] };
};

export type GetLoanQueryVariables = { id: Scalars['String'] };
export type GetLoanQuery = {
  loan: {
    id: Scalars['String'];
    data: Record<string, unknown>;
    meta: { created_at: string; status: string; updated_at: string };
  };
};
