// meap_xslt_bindings.js

// 模拟 transformhtml 方法
function transformhtml(param, res, options) {
    // 假设的处理逻辑
    console.log("[meap_xslt_bindings] transformhtml called");
    return `<html><body>Transformed HTML with param: ${param}</body></html>`;
}

// 模拟 transformxml 方法
function transformxml(param, res, options) {
    // 假设的处理逻辑
    console.log("[meap_xslt_bindings] transformxml called");
    return `<xml><data>Transformed XML with param: ${param}</data></xml>`;
}

// 导出模块
module.exports = {
    transformhtml: transformhtml,
    transformxml: transformxml
};
