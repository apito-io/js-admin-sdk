/**
 * React Query hooks placeholder — run `npm run gen` after schema validation passes.
 * Requires @tanstack/react-query (peer dependency).
 */
import {
  useMutation,
  useQuery,
  type UseMutationOptions,
  type UseQueryOptions,
} from '@tanstack/react-query';
import type { ApitoFetcher } from './fetcher';
import type {
  GetLoanListQuery,
  GetLoanListQueryVariables,
  GetLoanQuery,
  GetLoanQueryVariables,
} from './types';
import { getSdk } from './sdk';

export function useGetLoanListQuery(
  client: ApitoFetcher,
  variables?: GetLoanListQueryVariables,
  options?: Omit<UseQueryOptions<GetLoanListQuery>, 'queryKey' | 'queryFn'>
) {
  const sdk = getSdk(client);
  return useQuery({
    queryKey: ['GetLoanList', variables],
    queryFn: () => sdk.GetLoanList(variables).then((r) => r.data),
    ...options,
  });
}

export function useGetLoanQuery(
  client: ApitoFetcher,
  variables: GetLoanQueryVariables,
  options?: Omit<UseQueryOptions<GetLoanQuery>, 'queryKey' | 'queryFn'>
) {
  const sdk = getSdk(client);
  return useQuery({
    queryKey: ['GetLoan', variables],
    queryFn: () => sdk.GetLoan(variables).then((r) => r.data),
    ...options,
  });
}

export function useCreateLoanMutation(
  client: ApitoFetcher,
  options?: UseMutationOptions<unknown, Error, Record<string, unknown>>
) {
  return useMutation({
    mutationKey: ['CreateLoan'],
    mutationFn: (variables: Record<string, unknown>) =>
      client(
        `mutation CreateLoan($payload: Loan_Create_Payload!, $connect: Loan_Relation_Connect_Payload) { createLoan(payload: $payload, connect: $connect, status: published) { id } }`,
        variables
      ),
    ...options,
  });
}
