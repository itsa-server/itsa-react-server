const {Readable} = require('stream');

module.exports = async (request, reply) => {
    const stream = new Readable({
        read() {
            this.push('chunk-1,');
            this.push('chunk-2');
            this.push(null);
        }
    });
    reply(stream)
        .header('content-type', 'text/plain; charset=utf-8')
        .header('content-disposition', 'attachment; filename="data.txt"');
};
