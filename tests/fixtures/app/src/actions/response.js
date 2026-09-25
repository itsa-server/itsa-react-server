module.exports = async (request, h) => h.response({created: true}).code(201).header('x-custom', 'yes');
