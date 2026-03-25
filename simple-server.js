const http = require('http');
const fs = require('fs');
const path = require('path');

const rootPath = path.resolve(__dirname);
console.log(`Starting native server with root: ${rootPath}`);

const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
};

http.createServer(function (req, res) {
    console.log(`> Request: ${req.url}`);
    
    let filePath = path.join(rootPath, req.url);
    
    // Check if the path is a directory and try for index.html
    fs.stat(filePath, (err, stats) => {
        if (!err && stats.isDirectory()) {
            filePath = path.join(filePath, 'index.html');
        }

        const extname = String(path.extname(filePath)).toLowerCase();
        const contentType = mimeTypes[extname] || 'application/octet-stream';

        fs.readFile(filePath, function(error, content) {
            if (error) {
                if(error.code == 'ENOENT') {
                    console.error(`> 404: ${filePath}`);
                    res.writeHead(404);
                    res.end('File not found');
                } else {
                    console.error(`> 500: ${error.code}`);
                    res.writeHead(500);
                    res.end('Server error: ' + error.code);
                }
            } else {
                console.log(`> 200: ${filePath}`);
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(content, 'utf-8');
            }
        });
    });

}).listen(8081, '0.0.0.0', () => {
    console.log("> Native server is listening on http://0.0.0.0:8081");
});
