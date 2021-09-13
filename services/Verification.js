'use strict';

const crypto = require('crypto');
const { env } = require('strapi-utils');

/**
 * Verification code validity (in seconds), default: 10 min
 */
 const CODE_VALIDITY = env('EMAIL_VERIFICATION_VALIDITY', 10*60);

/**
 * Email 'from' field can be customized, or falls back to
 * the default address configured for the email plugin
 */
const FROM_ADDRESS = env(
  'EMAIL_VERIFICATION_SENDER',
  strapi.config.plugins.email.settings.from
);

// Prepare localization
const fs = require('fs');
const { join, basename } = require('path');
const { FluentBundle, FluentResource } = require('@fluent/bundle');

const LOCALE_DIR = join(__dirname, '../locales');
const FALLBACK_LOCALE = 'en';
const localization = {};

for (const f of fs.readdirSync(LOCALE_DIR)) {
  const lang = basename(f,'.ftl');
  const locale = fs.readFileSync(join(LOCALE_DIR, f)).toString();

  const res = new FluentResource(locale);
  const bundle = new FluentBundle(lang);
  bundle.addResource(res);

  localization[lang] = bundle;
}


/**
 * email-verification.js service
 *
 * @description: A set of functions similar to controller's actions to avoid code duplication.
 */

module.exports = {
  /**
   * Requests a new code sent to `email`
   * @returns numeric code or throws otherwise
   */
  async request(email, reason, language = FALLBACK_LOCALE) {
    if (typeof email != 'string' || email.includes('@') == false ) {
      throw('Invalid email address.');
    }

    // Delete previous requests, if there were any lingering
    await remove(email);

    // Generate a random verification code
    const code = this.code();
    
    // Store in strapi db
    await strapi.query('request','email-verification').create({
      email,
      code,
      expiry: new Date(Date.now()+CODE_VALIDITY*1000),
    });

    // TODO: move this into the admin interface & make customizable
    // TODO: make this localizable
    await strapi.plugins['md-email'].services.email.send(
      // Subject
      this.l10n(language, 'email-verification-subject'),

      // Body template
      this.l10n(language, 'email-verification-body'),

      // Recipient and other options
      {
        to: email,
        from: FROM_ADDRESS,
      },

      // Variables for the template
      { email, reason, code }
    );

    return code;
  },

  /**
   * Verifies if the given email+code combination is valid
   * 
   * @param {*} email 
   * @param {*} verif 
   * @returns String "valid", if valid, otherwise "e-expired" or "e-failed" on error
   */
  async verify(email, verif) {
    try {
      // Query pending verifications for the given email address
      const res = await strapi.query('request','email-verification').findOne(
        { email }
      );

      if (!res) return 'e-failed';

      const { code, expiry } = res;

      // Check expiry
      if ((new Date(expiry)).valueOf() < Date.now()) {
        await remove(email);
        return 'e-expired';
      }

      // Check verification code match
      if (parseInt(code, 10) !== parseInt(verif, 10)) {
        await remove(email);
        return 'e-failed';
      }
    }
    catch(e) {
      return 'e-error';
    }
    
    await remove(email);
    return 'valid';
  },

  /**
   * Generates a new 6-digit numeric verification code
   */
   code() {
    return crypto.randomInt(100000,1000000);
  },

  l10n(lang, message, params) {
    const bundle = localization[lang];
    if (!bundle) return '';

    const { value } = bundle.getMessage(message) ?? {};
    if (!value) return this.l10n(FALLBACK_LOCALE, message, params);

    return bundle.formatPattern(value, params);
  },
};

async function remove(email) {
  return strapi.query('request','email-verification').delete({ email });
}