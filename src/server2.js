const http2 = require("http2");
const fs = require("fs");
const path = require("path");

const pemPath = path.resolve(__dirname, "../ssl/key.pem");
const certPaht = path.resolve(__dirname, "../ssl/cert.pem");
// 定义静态目录
const staticPath = path.resolve(__dirname, "../public");
const fileInfoMap = createFileInfoMap();

// 获取 HTTP2 header 常量
const { HTTP2_HEADER_PATH, HTTP2_HEADER_STATUS } = http2.constants;

// 获取静态目录下的所有文件信息
function createFileInfoMap() {
    let fileInfoMap = new Map();
    const fileList = fs.readdirSync(staticPath);
    const contentTypeMap = {
        js: "application/javascript",
        css: "text/css",
        html: "text/html"
    };

    fileList.forEach(file => {
        const fd = fs.openSync(path.resolve(staticPath, file), "r");
        const contentType = contentTypeMap[file.split(".")[1]];

        const stat = fs.fstatSync(fd);

        const headers = {
            "content-length": stat.size,
            "last-modified": stat.mtime.toUTCString(),
            "content-type": contentType
        };

        fileInfoMap.set(`/${file}`, {
            fd,
            headers
        });
    });

    return fileInfoMap;
}



// 将传入的文件推送到浏览器
function push(stream, path) {
    const file = fileInfoMap.get(path);

    if (!file) {
        return;
    }

    stream.pushStream({ [HTTP2_HEADER_PATH]: path }, (err, pushStream) => {
        pushStream.respondWithFD(file.fd, file.headers);
    });
}

const server = http2.createSecureServer({
    key: fs.readFileSync(pemPath),
    cert: fs.readFileSync(certPaht)
});
server.on("error", err => console.error(err));

server.on("stream", (stream, headers) => {
    // 获取请求路径
    let requestPath = headers[HTTP2_HEADER_PATH];

    // 请求到 '/' 的请求返回 index.html
    if (requestPath === "/") {
        requestPath = "/index.html";
    }

    // 根据请求路径获取对应的文件信息
    const fileInfo = fileInfoMap.get(requestPath);
    if (!fileInfo) {
        stream.respond({
            [HTTP2_HEADER_STATUS]: 404
        });
        stream.end("Not found");
    }

    // 访问首页时同时推送其他文件资源
    if (requestPath === "/index.html") {
        for (let key in fileInfoMap.keys()) {
            push(stream, key);
        }
    }

    // 推送首页数据
    stream.respondWithFD(fileInfo.fd, {
        ...fileInfo.headers
    });
});

server.listen(8080);