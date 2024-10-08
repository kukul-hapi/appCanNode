
var soap = require("./meap_soap");
exports.BasicAuthSecurity = soap.BasicAuthSecurity;
exports.WSSecurity = soap.WSSecurity;
exports.ClientSSLSecurity = soap.ClientSSLSecurity;

function build(e) {
    return {"status": "15000", "message": e.message, "errno": e.number};
}

exports.build = build;

exports.Expires = {
    fileMatch: /^(gif|png|jpg|js|css)$/ig,
    maxAge: 60 * 60 * 24 * 365
};
exports.Compress = {
    match: /css|js|html/ig
};
exports.Welcome = {
    file: "null"
};
exports.fsroot = "/tmp";
exports.types = {
    "css": "text/css",
    "gif": "image/gif",
    "html": "text/html",
    "ico": "image/x-icon",
    "jpeg": "image/jpeg",
    "jpg": "image/jpeg",
    "js": "text/javascript",
    "json": "application/json",
    "pdf": "application/pdf",
    "png": "image/png",
    "svg": "image/svg+xml",
    "swf": "application/x-shockwave-flash",
    "tiff": "image/tiff",
    "txt": "text/plain",
    "wav": "audio/x-wav",
    "wma": "audio/x-ms-wma",
    "wmv": "video/x-ms-wmv",
    "xml": "text/xml",
    "caf": "audio/x-caf",
    "amr": "audio/amr",
    "awb": "audio/amr-wb",
    "doc": "application/msword",
    "dot": "application/msword",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "dotx": "application/vnd.openxmlformats-officedocument.wordprocessingml.template",
    "docm": "application/vnd.ms-word.document.macroEnabled.12",
    "dotm": "application/vnd.ms-word.template.macroEnabled.12",
    "xls": "application/vnd.ms-excel",
    "xlt": "application/vnd.ms-excel",
    "xla": "application/vnd.ms-excel",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "xltx": "application/vnd.openxmlformats-officedocument.spreadsheetml.template",
    "xlsm": "application/vnd.ms-excel.sheet.macroEnabled.12",
    "xltm": "application/vnd.ms-excel.template.macroEnabled.12",
    "xlam": "application/vnd.ms-excel.addin.macroEnabled.12",
    "xlsb": "application/vnd.ms-excel.sheet.binary.macroEnabled.12",
    "ppt": "application/vnd.ms-powerpoint",
    "pot": "application/vnd.ms-powerpoint",
    "pps": "application/vnd.ms-powerpoint",
    "ppa": "application/vnd.ms-powerpoint",
    "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "potx": "application/vnd.openxmlformats-officedocument.presentationml.template",
    "ppsx": "application/vnd.openxmlformats-officedocument.presentationml.slideshow",
    "ppam": "application/vnd.ms-powerpoint.addin.macroEnabled.12",
    "pptm": "application/vnd.ms-powerpoint.presentation.macroEnabled.12",
    "potm": "application/vnd.ms-powerpoint.template.macroEnabled.12",
    "ppsm": "application/vnd.ms-powerpoint.slideshow.macroEnabled.12"
};


