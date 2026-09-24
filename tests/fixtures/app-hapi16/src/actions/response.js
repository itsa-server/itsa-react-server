module.exports = async (request, reply) => {
    reply({created: true}).code(201).header('x-custom', 'yes');
};
