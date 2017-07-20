/**
 *
 * <i>Copyright (c) 2017 ItsAsbreuk - http://itsasbreuk.nl</i><br>
 * New BSD License - http://choosealicense.com/licenses/bsd-3-clause/
 *
 *
 * @since 16.2.0
*/

'use strict';

// see http://googlewebmastercentral.blogspot.nl/2011/03/mo-better-to-also-detect-mobile-user.html
var MOBILE = 'mobile',
    IPAD = 'ipad',
    ANDROID = 'android',
    PHONE = 'phone',
    TABLET = 'tablet',
    DESKTOP = 'desktop';

/**
@method device
@private
**/
var getDevice = function(ua) {
    if (!ua) {
        return DESKTOP;
    }

    ua = ua.toLowerCase();

    if (ua.indexOf(IPAD)!==-1) {
        // ipad has both `ipad` and `mobile`
        return TABLET;
    }

    if (ua.indexOf(MOBILE)!==-1) {
        // android has both `android` and `mobile` only when it's a phone
        return PHONE;
    }

    if (ua.indexOf(ANDROID)!==-1) {
        // android has only `android` without `mobile` when its a tablet
        return TABLET;
    }

    return DESKTOP;
};

module.exports = {
    getDevice: getDevice
};
