'use strict';

describe('computeStackTrace', () => {
  describe('domain regex', () => {
    const regex = /(.*)\:\/\/([^\/]+)\/{0,1}([\s\S]*)/;

    it('should return subdomains properly', () => {
      const url = 'https://subdomain.yoursite.com/assets/main.js';
      const domain = 'subdomain.yoursite.com';
      expect(regex.exec(url)[2]).toBe(domain);
    });
    it('should return domains correctly with any protocol', () => {
      const url = 'http://yoursite.com/assets/main.js';
      const domain = 'yoursite.com';

      expect(regex.exec(url)[2]).toBe(domain);
    });
    it('should return the correct domain when directories match the domain', () => {
      const url = 'https://mysite.com/mysite/main.js';
      const domain = 'mysite.com';

      expect(regex.exec(url)[2]).toBe(domain);
    });
  });
});
