//import { Vector3 } from "./cuon-matrix-cse160.js";

//------------------------------------------------------------------------------
// OBJParser
//------------------------------------------------------------------------------
// prettier-ignore
class OBJLoader {
  constructor(filePath) {
      this.filePath = filePath;
      this.mtls = new Array(0);      // Initialize the property for MTL
      this.objects = new Array(0);   // Initialize the property for Object
      this.vertices = new Array(0);  // Initialize the property for Vertex
      this.normals = new Array(0);   // Initialize the property for Normal

      // whether the .obj file has been fully parsed
      // note that this can be true before all materials have been parsed, so don't access this directly
      // use isFullyLoaded instead (as that returns true only when *both* the OBJ and MTL are fully loaded)
      this.isOBJFullyParsed = false;
  }

  // Parsing the OBJ file
  async parse(fileString, scale, reverse) {
      let lines = fileString.split('\n');  // Break up into lines and store them as array
      lines.push(null); // Append null
      let index = 0;    // Initialize index of line

      //if no object group 
      let currentObject = null;//new OBJObject("default");
      let currentMaterialName = "";

      // Parse line by line
      let line;         // A string in the line to be parsed
      let sp = new StringParser();  // Create StringParser

      let vCount = 0;
      while ((line = lines[index++]) != null) {
          sp.init(line);                  // init StringParser
          let command = sp.getWord();     // Get command
          if (command == null) continue;  // check null command

          switch (command) {
              case '#':
                  continue;  // Skip comments
              case 'mtllib':     // Read Material chunk
                  let path = this.parseMtllib(sp, this.filePath);
                  let mtl = new MTLDoc();   // Create MTL instance
                  this.mtls.push(mtl);
                  
                  // make async request for .mtls. 
                  // this allows us to make parse() async, meaning that Model.loadModel() won't resolve and call .then() until the mtl has been full parsed
                  const response = await fetch(path);
                  if (!response.ok) throw new Error(`Could not load material "${path}". Is the .mtl file in the same folder as the .obj file?`);

                  const fileContent = await response.text();
                  LoaderUtils.onReadMTLFile(fileContent, mtl);

                  mtl.complete = true;

                  continue; 
              case 'o':
              case 'g':   // Read Object name
                  let object = this.parseObjectName(sp);
                  this.objects.push(object);
                  currentObject = object;
                  continue; 
              case 'v':   // Read vertex
                  let vertex = this.parseVertex(sp, scale);
                  this.vertices.push(vertex);
                  vCount++;
                  continue; 
              case 'vn':   // Read normal
                  let normal = this.parseNormal(sp);
                  this.normals.push(normal);
                  continue; 
              case 'usemtl': // Read Material name
                  currentMaterialName = this.parseUsemtl(sp);
                  continue; 
              case 'f': // Read face
                  let face = this.parseFace(sp, currentMaterialName, this.vertices, reverse);
                  //some obj files dont have object markings at all. 
                  if (!currentObject) {
                      currentObject = new OBJObject("NewObject");
                      this.objects.push(currentObject);
                  }
                  //console.log(face)
                  currentObject.addFace(face);
                  continue; 
          }
      }

      this.isOBJFullyParsed = true;
      return true;
  }

  // wrapper function for .parse() with error handling 
  async parseModel() {
    try {
        const response = await fetch(this.filePath);
        if (!response.ok) throw new Error(`Could not load file "${this.filePath}". Are you sure the file name/path are correct?`);

        const fileContent = await response.text();

        let result = await this.parse(fileContent, 1.0, true);
        if (!result) throw new Error(`Something went wrong parsing the .obj file.`);

        // if the model is too big, indices.length needs to be a uint32 array. to get access to gl.UNSIGNED_INT, we need to enable this extension
        // gl.getExtension('OES_element_index_uint');
    } catch (e) {
        throw new Error(`Something went wrong when loading ${this.filePath}. Error: ${e}`);
    }
  }

  parseMtllib(sp, fileName) {
      // Get directory path
      let i = fileName.lastIndexOf("/");
      let dirPath = "";
      if (i > 0) dirPath = fileName.substr(0, i + 1);

      return dirPath + sp.getWord();   // Get path
  }

  parseObjectName(sp) {
      let name = sp.getWord();
      return (new OBJObject(name));
  }

  parseVertex(sp, scale) {
      let x = sp.getFloat() * scale;
      let y = sp.getFloat() * scale;
      let z = sp.getFloat() * scale;
      return (new Vertex(x, y, z));
  }

  parseNormal(sp) {
      let x = sp.getFloat();
      let y = sp.getFloat();
      let z = sp.getFloat();
      return (new Normal(x, y, z));
  }

  parseUsemtl(sp) {
      return sp.getWord();
  }

  parseFace(sp, materialName, vertices, reverse) {
      let face = new Face(materialName);
      // get indices
      for (; ;) {
          let word = sp.getWord();
          if (word == null) break;
          let subWords = word.split('/');
          if (subWords.length >= 1) {
              let vi = parseInt(subWords[0]) - 1;
              face.vIndices.push(vi);
          }
          if (subWords.length >= 3) {
              let ni = parseInt(subWords[2]) - 1;
              face.nIndices.push(ni);
          } else {
              face.nIndices.push(-1);
          }
      }

      // calc normal
      let v0 = [
          vertices[face.vIndices[0]].x,
          vertices[face.vIndices[0]].y,
          vertices[face.vIndices[0]].z];
      let v1 = [
          vertices[face.vIndices[1]].x,
          vertices[face.vIndices[1]].y,
          vertices[face.vIndices[1]].z];
      let v2 = [
          vertices[face.vIndices[2]].x,
          vertices[face.vIndices[2]].y,
          vertices[face.vIndices[2]].z];

      // Calculate the face normal and set it to normal
      let normal = LoaderUtils.calcNormal(v0, v1, v2);
      // Check if the normals were found correctly
      if (normal == null) {
          if (face.vIndices.length >= 4) { // If the face is a quadrilateral, calculate the normal using a combination of three other points
              let v3 = [
                  vertices[face.vIndices[3]].x,
                  vertices[face.vIndices[3]].y,
                  vertices[face.vIndices[3]].z];
              normal = LoaderUtils.calcNormal(v1, v2, v3);
          }
          if (normal == null) {         // The normal could not be calculated, so the normal in the Y-axis direction is used.
              normal = [0.0, 1.0, 0.0];
          }
      }
      if (reverse) {
          normal[0] = -normal[0];
          normal[1] = -normal[1];
          normal[2] = -normal[2];
      }
      face.normal = new Normal(normal[0], normal[1], normal[2]);

      // Devide to triangles if face contains over 3 points.
      if (face.vIndices.length > 3) {
          let n = face.vIndices.length - 2;
          let newVIndices = new Array(n * 3);
          let newNIndices = new Array(n * 3);
          for (let i = 0; i < n; i++) {
              newVIndices[i * 3 + 0] = face.vIndices[0];
              newVIndices[i * 3 + 1] = face.vIndices[i + 1];
              newVIndices[i * 3 + 2] = face.vIndices[i + 2];
              newNIndices[i * 3 + 0] = face.nIndices[0];
              newNIndices[i * 3 + 1] = face.nIndices[i + 1];
              newNIndices[i * 3 + 2] = face.nIndices[i + 2];
          }
          face.vIndices = newVIndices;
          face.nIndices = newNIndices;
      }
      face.numIndices = face.vIndices.length;

      return face;
  }

  // Check Materials
  isMTLComplete() {
      if (this.mtls.length == 0) return true;
      for (let i = 0; i < this.mtls.length; i++) {
          if (!this.mtls[i].complete) return false;
      }
      return true;
  }

  // Find color by material name
  findColor(name) {
      for (let i = 0; i < this.mtls.length; i++) {
          for (let j = 0; j < this.mtls[i].materials.length; j++) {
              if (this.mtls[i].materials[j].name == name) {
                  return (this.mtls[i].materials[j].color)
              }
          }
      }
      return (new Color(1.0, 0.0, 1.0, 1)); // the purple color from the source engine "missing texture" checkerboard texture
  }

  // Retrieve the information for drawing 3D model
  getModelData() {
      // Create an arrays for vertex coordinates, normals, colors, and indices
      let numIndices = 0;
      for (let i = 0; i < this.objects.length; i++) {
          numIndices += this.objects[i].numIndices;
      }
      let numVertices = numIndices;
      let vertices = new Float32Array(numVertices * 3);
      let normals = new Float32Array(numVertices * 3);
      let colors = new Float32Array(numVertices * 4);
      let indices = new Uint32Array(numIndices);    // NOTE: by default, this is a Uint16Array, but if the model is too big (i.e its vertex count exceeds 65535, it overflows). this needs to be an uint32 array for big models. 

      // Set vertex, normal and color
      let index_indices = 0;
      for (let i = 0; i < this.objects.length; i++) {
          let object = this.objects[i];
          for (let j = 0; j < object.faces.length; j++) {
              let face = object.faces[j];
              let color = this.findColor(face.materialName);
              let faceNormal = face.normal;
              for (let k = 0; k < face.vIndices.length; k++) {
                  // Set index
                  indices[index_indices] = index_indices;
                  // Copy vertex
                  let vIdx = face.vIndices[k];
                  let vertex = this.vertices[vIdx];
                  vertices[index_indices * 3 + 0] = vertex.x;
                  vertices[index_indices * 3 + 1] = vertex.y;
                  vertices[index_indices * 3 + 2] = vertex.z;
                  // Copy color
                  colors[index_indices * 4 + 0] = color.r;
                  colors[index_indices * 4 + 1] = color.g;
                  colors[index_indices * 4 + 2] = color.b;
                  colors[index_indices * 4 + 3] = color.a;
                  // Copy normal
                  let nIdx = face.nIndices[k];
                  if (nIdx >= 0) {
                      let normal = this.normals[nIdx];
                      normals[index_indices * 3 + 0] = normal.x;
                      normals[index_indices * 3 + 1] = normal.y;
                      normals[index_indices * 3 + 2] = normal.z;
                  } else {
                      normals[index_indices * 3 + 0] = faceNormal.x;
                      normals[index_indices * 3 + 1] = faceNormal.y;
                      normals[index_indices * 3 + 2] = faceNormal.z;
                  }
                  index_indices++;
              }
          }
      }

      //return new DrawingInfo(vertices, normals, colors, indices);
      
      // unpack index buffer
      let unpackedVerts = [];
      let unpackedNormals = [];
      // let unpackedColors = [];

      for (let i = 0; i < indices.length; i++) {
          unpackedVerts.push(vertices[i * 3], vertices[i * 3 + 1], vertices[i * 3 + 2]);
          unpackedNormals.push(normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2]);
          // unpackedColors.push(colors[i * 4], colors[i * 4 + 1], colors[i * 4 + 2], colors[i * 4 + 3]);
      }

      return {
        vertices: unpackedVerts,
        normals: unpackedNormals,
        // colors: unpackedColors
      }

      return new DrawingInfo(new Float32Array(unpackedVerts), new Float32Array(unpackedNormals), new Float32Array(unpackedColors), []);
  }

  // wrapper property with an easier to remember name
  get isFullyLoaded() {
      return this.isOBJFullyParsed && this.isMTLComplete();
  }

}

//------------------------------------------------------------------------------
// MTLDoc Object
//------------------------------------------------------------------------------
class MTLDoc {
  constructor() {
    this.complete = false; // MTL is configured correctly
    this.materials = new Array(0);
  }

  parseNewmtl(sp) {
    return sp.getWord(); // Get name
  }

  parseRGB(sp, name) {
    let r = sp.getFloat();
    let g = sp.getFloat();
    let b = sp.getFloat();
    return new Material(name, r, g, b, 1);
  }
}

//------------------------------------------------------------------------------
// Material Object
//------------------------------------------------------------------------------
class Material {
  constructor(name, r, g, b, a) {
    this.name = name;
    this.color = new Color(r, g, b, a);
  }
}

//------------------------------------------------------------------------------
// Vertex Object
//------------------------------------------------------------------------------
class Vertex {
  constructor(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
}

//------------------------------------------------------------------------------
// Normal Object
//------------------------------------------------------------------------------
class Normal {
  constructor(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
}

//------------------------------------------------------------------------------
// Color Object
//------------------------------------------------------------------------------
class Color {
  constructor(r, g, b, a) {
    this.r = r;
    this.g = g;
    this.b = b;
    this.a = a;
  }
}

//------------------------------------------------------------------------------
// OBJObject Object
//------------------------------------------------------------------------------
class OBJObject {
  constructor(name) {
    this.name = name;
    this.faces = new Array(0);
    this.numIndices = 0;
  }

  addFace(face) {
    this.faces.push(face);
    this.numIndices += face.numIndices;
  }
}

//------------------------------------------------------------------------------
// Face Object
//------------------------------------------------------------------------------
class Face {
  constructor(materialName) {
    this.materialName = materialName;
    if (materialName == null) this.materialName = "";
    this.vIndices = new Array(0);
    this.nIndices = new Array(0);
  }
}

//------------------------------------------------------------------------------
// DrawInfo Object
//------------------------------------------------------------------------------
class DrawingInfo {
  constructor(vertices, normals, colors, indices) {
    this.vertices = vertices;
    this.normals = normals;
    this.colors = colors;
    this.indices = indices;
  }
}

//------------------------------------------------------------------------------
// StringParser Object
//------------------------------------------------------------------------------
class StringParser {
  constructor(str) {
    this.str; // Store the string specified by the argument
    this.index; // Position in the string to be processed
    this.init(str);
  }

  // Initialize StringParser object
  init(str) {
    this.str = str;
    this.index = 0;
  }

  // Skip delimiters
  skipDelimiters() {
    let i, len;
    for (i = this.index, len = this.str.length; i < len; i++) {
      let c = this.str.charAt(i);
      // Skip TAB, Space, '(', ')', '"', and '\r'
      if (
        c == "\t" ||
        c == " " ||
        c == "(" ||
        c == ")" ||
        c == '"' ||
        c == "\r"
      )
        continue;
      break;
    }
    this.index = i;
  }

  // Skip to the next word
  skipToNextWord() {
    this.skipDelimiters();
    let n = this.getWordLength(this.str, this.index);
    this.index += n + 1;
  }

  // Get word
  getWord() {
    this.skipDelimiters();
    let n = this.getWordLength(this.str, this.index);
    if (n == 0) return null;
    let word = this.str.substr(this.index, n);
    this.index += n + 1;

    return word;
  }

  // Get integer
  getInt() {
    return parseInt(this.getWord());
  }

  // Get floating number
  getFloat() {
    return parseFloat(this.getWord());
  }

  // Get the length of word
  getWordLength(str, start) {
    let i, len;
    for (i = start, len = str.length; i < len; i++) {
      let c = str.charAt(i);
      if (
        c == "\t" ||
        c == " " ||
        c == "(" ||
        c == ")" ||
        c == '"' ||
        c == "\r"
      )
        break;
    }
    return i - start;
  }
}

//------------------------------------------------------------------------------
// Common functions
//------------------------------------------------------------------------------
class LoaderUtils {
  constructor() {
    throw new Error("LoaderUtils is a static class; do not instantiate it.");
  }

  static calcNormal(p0, p1, p2) {
    // v0: a vector from p1 to p0, v1; a vector from p1 to p2
    let v0 = new Float32Array(3);
    let v1 = new Float32Array(3);
    for (let i = 0; i < 3; i++) {
      v0[i] = p0[i] - p1[i];
      v1[i] = p2[i] - p1[i];
    }

    // The cross product of v0 and v1
    let c = new Float32Array(3);
    c[0] = v0[1] * v1[2] - v0[2] * v1[1];
    c[1] = v0[2] * v1[0] - v0[0] * v1[2];
    c[2] = v0[0] * v1[1] - v0[1] * v1[0];

    // Normalize the result
    let v = new Vector3(c);
    v.normalize();
    return v.elements;
  }

  // Analyze the material file
  static onReadMTLFile(fileString, mtl) {
    let lines = fileString.split("\n");
    lines.push(null); // Append null, because obj/mtls are 1-indexed
    let index = 0;

    // these commands specify the following texture maps:
    // ambient maps, diffuse maps, specular maps, specular exponent maps, dissolve maps, displacement maps, decal maps, bump maps
    // which this loader does not support.
    // https://paulbourke.net/dataformats/mtl/
    let textureMapStatements = new Set([
      "map_Ka",
      "map_Kd",
      "map_Ks",
      "map_Ns",
      "map_d",
      "disp",
      "decal",
      "bump",
    ]);

    // Parse line by line
    let line;
    let name = ""; // Material name
    let sp = new StringParser();
    while ((line = lines[index++]) != null) {
      sp.init(line);
      let command = sp.getWord();
      if (command == null) continue;

      switch (command) {
        case "#":
          // Skip comments
          continue;
        case "newmtl":
          // Read Material chunk
          name = mtl.parseNewmtl(sp);
          continue;
        case "Kd":
          if (name == "") continue; // Go to next line because of Error
          let material = mtl.parseRGB(sp, name);
          mtl.materials.push(material);
          name = "";
          continue;
        default:
          if (textureMapStatements.has(command)) {
            console.warn(
              `Warning: This OBJ file specifies the use of texture maps, which are unsupported by this loader. Parts, or even all of this model might not appear correctly. `
            );
          }
      }
    }
    mtl.complete = true;
  }
}
