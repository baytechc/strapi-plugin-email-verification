'use strict';

/**
 * API to do e-mail verification
 *
 * @description: A set of endpoints that allow for email verification.
 * A unique numeric code is sent to the requesting email address,
 * which can be cross-referenced and used with some protected action
 * (registration, submission of a form or comments or similar).
 */


module.exports = {

  /**
   * Request a verification code to one's `email` address for a
   * specific `reason`.
   *
   * @return {Object}
   */
  async request(ctx) {
    const { email, reason } = ctx.request.body;

    try {
      const code = await strapi.plugins['email-verification'].services.verification.request(
        email, reason, requestLanguage(ctx)
      );

      console.log(`[verify-email] Code sent (${code}): ${email}`);

    } catch(e) {
      console.log(`[verify-email] Error: ${e.message}`);
      console.error(new Date().toISOString(), e);

      return ctx.throw(500);
    }

    ctx.send(200);
  },

  /**
   * Verify a given code.
   *
   * @return {Object}
   */
  async verify(ctx) {
    // TODO:
    ctx.send(404);
  },
};

// Extract the current locale from the request headers
function requestLanguage(ctx) {
  const acceptLang = require('accept-language-parser').parse(ctx.request.headers['accept-language']);
  return acceptLang[0]?.code;
}
