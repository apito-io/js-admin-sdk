import { DocumentBuilder } from '../naming/documentBuilder';
import { ApitoSchemaField, ApitoSchemaModel } from '../naming/schemaReader';

describe('operation doc contract', () => {
  it('loan emits 5 canonical operations', () => {
    const model: ApitoSchemaModel = {
      name: 'loan',
      fields: [
        { name: 'loan_id' },
        { name: 'loan_status' },
        { name: 'total_amount' },
      ],
    };
    const fields = model.fields.map((f) => f.name);
    const doc = new DocumentBuilder('loan').generateGraphqlFile(fields);

    expect(doc).toContain('query GetLoanList(');
    expect(doc).toContain('query GetLoan(');
    expect(doc).toContain('mutation CreateLoan(');
    expect(doc).toContain('mutation UpdateLoan(');
    expect(doc).toContain('mutation DeleteLoan(');
    expect(doc).toContain('LOANLIST_INPUT_WHERE_PAYLOAD');
    expect(doc).toContain('LOAN_WHERE_RELATION_FILTER_CONDITION');
    expect(doc).toContain('Loan_Create_Payload');
  });

  it('list query matches DocumentBuilder', () => {
    const list = new DocumentBuilder('loan').buildListQuery(['loan_id']);
    const full = new DocumentBuilder('loan').generateGraphqlFile(['loan_id']);
    expect(full).toContain(list.trim());
  });

  it('omits relation connect/disconnect when supportsConnection is false', () => {
    const doc = new DocumentBuilder('staff', { supportsConnection: false }).generateGraphqlFile([
      'name',
    ]);
    expect(doc).not.toContain('Relation_Connect_Payload');
    expect(doc).not.toContain('Relation_Disconnect_Payload');
    expect(doc).toContain('mutation UpdateStaff(');
    expect(doc).toContain('payload: $payload, status: published');
  });
});
