import { resolveProjectBase } from './config';

describe('resolveProjectBase', () => {
  it('uses the local XAMPP project path on localhost', () => {
    expect(resolveProjectBase('http://localhost')).toBe('http://localhost/GitHub/pastry-project');
  });

  it('keeps the customer app path under the project root', () => {
    expect(resolveProjectBase('http://localhost', '/customer')).toBe('http://localhost/GitHub/pastry-project/customer');
  });

  it('uses the project path that matches the customer portal router', () => {
    window.history.replaceState({}, '', '/pastry-project/customer/settings');

    expect(resolveProjectBase('http://localhost')).toBe('http://localhost/pastry-project');
  });
});
