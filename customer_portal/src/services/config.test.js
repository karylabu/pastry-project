import { resolveProjectBase } from './config';

describe('resolveProjectBase', () => {
  it('uses the local XAMPP project path on localhost', () => {
    expect(resolveProjectBase('http://localhost')).toBe('http://localhost/pastry-project');
  });

  it('keeps the customer app path under the project root', () => {
    expect(resolveProjectBase('http://localhost', '/customer')).toBe('http://localhost/pastry-project/customer');
  });
});
