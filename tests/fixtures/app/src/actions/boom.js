const Boom = require('@hapi/boom');

module.exports = async () => {
    throw Boom.conflict('Project locked');
};
