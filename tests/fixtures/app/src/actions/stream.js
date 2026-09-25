const {Readable} = require('stream');

module.exports = async (request, h) => {
    const stream = new Readable({
        read() {
            this.push('chunk-1,');
            this.push('chunk-2');
            this.push(null);
        }
    });
    return h.response(stream)
        .header('content-type', 'text/plain; charset=utf-8')
        .header('content-disposition', 'attachment; filename="data.txt"');
};
