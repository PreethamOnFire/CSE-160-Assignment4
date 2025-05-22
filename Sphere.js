function generateSphereData() {
    var v = [];
    var vn = [];
    var uv = [];

    var d = Math.PI/10;
    var dd = Math.PI/10;

    for (let t = 0; t < Math.PI; t += d) {
        for (let r = 0; r < (2*Math.PI); r += d) {
            var p1 = [Math.sin(t)*Math.cos(r), Math.sin(t)*Math.sin(r), Math.cos(t)];

            var p2 = [Math.sin(t+dd)*Math.cos(r), Math.sin(t+dd)*Math.sin(r), Math.cos(t+dd)];
            var p3 = [Math.sin(t)*Math.cos(r+dd), Math.sin(t)*Math.sin(r+dd), Math.cos(t)];
            var p4 = [Math.sin(t+dd)*Math.cos(r+dd), Math.sin(t+dd)*Math.sin(r+dd), Math.cos(t+dd)];

            v = v.concat(p1); uv=uv.concat([0,0]); vn = vn.concat(p1);
            v = v.concat(p2); uv=uv.concat([0,0]); vn = vn.concat(p2);
            v = v.concat(p4); uv=uv.concat([0,0]); vn = vn.concat(p4);
            v = v.concat(p1); uv=uv.concat([0,0]); vn = vn.concat(p1);
            v = v.concat(p4); uv=uv.concat([0,0]); vn = vn.concat(p4);
            v = v.concat(p3); uv=uv.concat([0,0]); vn = vn.concat(p3);
        }
    }

    return {
        v,
        vn,
        uv,
        numVert: v.length/3,
    }
}

function setUpSphereBuffers() {
    let data = generateSphereData();
    sphereBuffers.vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, sphereBuffers.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.v), gl.STATIC_DRAW);

    sphereBuffers.UvBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, sphereBuffers.UvBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.uv), gl.STATIC_DRAW);

    sphereBuffers.normalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, sphereBuffers.normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.vn), gl.STATIC_DRAW);

    sphereBuffers.colorBuffer = gl.createBuffer();
    sphereBuffers.matrixBuffer = gl.createBuffer();
    sphereBuffers.normalMatrixBuffer = gl.createBuffer();
    sphereBuffers.numVert = data.numVert;
}