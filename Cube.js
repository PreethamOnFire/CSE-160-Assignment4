// Values are from mdnWebDocs

var vertexBuffer = null;
var indexBuffer = null;
var colorBuffer = null;
var cubeNormalsBuffer = null;
var cubeUVBuffer = null;


var cubeColors = [];

class Cube {
    constructor(){
        this.type="cube";
        this.color = [1.0, 0, 0, 0];
        this.matrix = new Matrix4();
        this.normalMatrix = new Matrix4();
        this.colorList = null;
    }

    render(){
        cubeColors = cubeColors.concat(this.color);
    }
}