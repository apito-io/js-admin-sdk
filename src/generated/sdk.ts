import type { ApitoFetcher } from './fetcher';
import type {
  GetLoanListQuery,
  GetLoanListQueryVariables,
  GetLoanQuery,
  GetLoanQueryVariables,
} from './types';

export type SdkFunctionWrapper = <T>(
  action: (requester: ApitoFetcher) => Promise<T>
) => Promise<T>;

export function getSdk(
  requester: ApitoFetcher,
  _wrap?: SdkFunctionWrapper
) {
  return {
    GetLoanList(
      variables?: GetLoanListQueryVariables
    ): Promise<{ data: GetLoanListQuery }> {
      const doc = `query GetLoanList($connection: LOAN_CONNECTION_FILTER_CONDITION, $where: LOANLIST_INPUT_WHERE_PAYLOAD, $whereCount: LOAN_LIST_COUNT_INPUT_WHERE_PAYLOAD, $sort: LOANLIST_INPUT_SORT_PAYLOAD, $page: Int, $limit: Int) { loanList(connection: $connection, where: $where, sort: $sort, page: $page, limit: $limit) { id data { loan_id } meta { created_at status updated_at } } loanListCount(connection: $connection, where: $whereCount, page: $page, limit: $limit) { total } }`;
      return requester(doc, variables).then((r) => ({
        data: r.data as GetLoanListQuery,
      }));
    },
    GetLoan(
      variables: GetLoanQueryVariables
    ): Promise<{ data: GetLoanQuery }> {
      const doc = `query GetLoan($id: String!) { loan(_id: $id) { id data { loan_id } meta { created_at status updated_at } } }`;
      return requester(doc, variables).then((r) => ({
        data: r.data as GetLoanQuery,
      }));
    },
  };
}

export type Sdk = ReturnType<typeof getSdk>;
