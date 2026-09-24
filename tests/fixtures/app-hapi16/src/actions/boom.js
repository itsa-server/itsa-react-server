const Boom = require('boom');

module.exports = async () => {
    throw Boom.conflict('Project locked');
};
