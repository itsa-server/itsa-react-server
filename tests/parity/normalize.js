'use strict';

const crypto = require('crypto');

// props that legitimately differ per run
const VOLATILE_APP_PROPS = ['serverStartup'];

const sortKeys = value => {
    if (Array.isArray(value)) {
        return value.map(sortKeys);
    }
    if (value && (typeof value==='object')) {
        return Object.keys(value).sort().reduce((result, key) => {
            result[key] = sortKeys(value[key]);
            return result;
        }, {});
    }
    return value;
};

const normalizeBody = (payload, contentType) => {
    let text = payload,
        parsed;
    if (contentType && (contentType.indexOf('application/json')!==-1)) {
        try {
            parsed = JSON.parse(payload);
            if (parsed && parsed.__appProps) {
                VOLATILE_APP_PROPS.forEach(key => {
                    delete parsed.__appProps[key];
                });
            }
            text = JSON.stringify(sortKeys(parsed));
        }
        catch (err) {
            text = payload;
        }
    }
    return {
        sha256: crypto.createHash('sha256').update(text).digest('hex'),
        preview: text.slice(0, 120)
    };
};

// cookie values are encrypted (random per run) and Expires is time based: compare everything else.
// SameSite is recorded separately so the parity test can check it on its own (spec §7.1).
const normalizeCookies = setCookie => {
    const lines = Array.isArray(setCookie) ? setCookie : (setCookie ? [setCookie] : []);
    return lines.map(line => {
        const parts = line.split(';').map(part => part.trim()),
            nameValue = parts.shift(),
            index = nameValue.indexOf('='),
            sameSitePart = parts.find(part => /^samesite=/i.test(part));
        return {
            name: nameValue.substr(0, index),
            empty: (nameValue.substr(index+1)===''),
            attributes: parts
                .filter(part => !/^(expires|samesite)=/i.test(part))
                .map(part => part.toLowerCase())
                .sort(),
            sameSite: sameSitePart ? sameSitePart.split('=')[1].toLowerCase() : null
        };
    }).sort((a, b) => ((a.name<b.name) ? -1 : ((a.name>b.name) ? 1 : 0)));
};

const normalizeResponse = res => ({
    status: res.statusCode,
    contentType: res.headers['content-type'] || null,
    noAuth: res.headers['x-noauth'] || null,
    etag: res.headers.etag || null,
    cookies: normalizeCookies(res.headers['set-cookie']),
    body: normalizeBody(res.payload, res.headers['content-type'])
});

module.exports = {
    normalizeResponse
};
