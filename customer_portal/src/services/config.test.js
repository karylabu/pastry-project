import { resolveProjectBase } from './config';

describe('resolveProjectBase', () => {
  it('uses the GitHub/pastry-project local path on localhost', () => {
    expect(resolveProjectBase('http://localhost')).toBe('http://localhost/GitHub/pastry-project');
  });

  it('keeps the customer app path under the project root', () => {
    expect(resolveProjectBase('http://localhost', '/customer')).toBe('http://localhost/GitHub/pastry-project/customer');
  });
});
