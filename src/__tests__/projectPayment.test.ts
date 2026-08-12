import { deriveSystemAPIBaseURL } from '../client';

describe('deriveSystemAPIBaseURL', () => {
  it('strips system graphql', () => {
    expect(deriveSystemAPIBaseURL('http://localhost:5050/system/graphql')).toBe(
      'http://localhost:5050'
    );
  });

  it('strips secured graphql', () => {
    expect(deriveSystemAPIBaseURL('http://localhost:5050/secured/graphql/')).toBe(
      'http://localhost:5050'
    );
  });
});
