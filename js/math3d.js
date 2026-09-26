export const Vec3 = {
  subtract(a, b) {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  },
  cross(a, b) {
    return [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ];
  },
  normalize(vector) {
    const length = Math.hypot(vector[0], vector[1], vector[2]);
    if (length < 0.000001) return [0, 0, 0];
    return [vector[0] / length, vector[1] / length, vector[2] / length];
  },
  dot(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  },
};

export const Mat4 = {
  identity() {
    return new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ]);
  },
  multiply(a, b) {
    const out = new Float32Array(16);
    for (let column = 0; column < 4; column += 1) {
      for (let row = 0; row < 4; row += 1) {
        for (let index = 0; index < 4; index += 1) {
          out[column * 4 + row] += a[index * 4 + row] * b[column * 4 + index];
        }
      }
    }
    return out;
  },
  translation(x, y, z) {
    const out = Mat4.identity();
    out[12] = x;
    out[13] = y;
    out[14] = z;
    return out;
  },
  rotationX(radians) {
    const cosine = Math.cos(radians);
    const sine = Math.sin(radians);
    return new Float32Array([
      1, 0, 0, 0,
      0, cosine, sine, 0,
      0, -sine, cosine, 0,
      0, 0, 0, 1,
    ]);
  },
  rotationY(radians) {
    const cosine = Math.cos(radians);
    const sine = Math.sin(radians);
    return new Float32Array([
      cosine, 0, -sine, 0,
      0, 1, 0, 0,
      sine, 0, cosine, 0,
      0, 0, 0, 1,
    ]);
  },
  scaling(x, y, z) {
    return new Float32Array([
      x, 0, 0, 0,
      0, y, 0, 0,
      0, 0, z, 0,
      0, 0, 0, 1,
    ]);
  },
  lookAt(position, target, up) {
    const backward = Vec3.normalize(Vec3.subtract(position, target));
    const right = Vec3.normalize(Vec3.cross(up, backward));
    const correctedUp = Vec3.cross(backward, right);
    return new Float32Array([
      right[0], correctedUp[0], backward[0], 0,
      right[1], correctedUp[1], backward[1], 0,
      right[2], correctedUp[2], backward[2], 0,
      -Vec3.dot(right, position), -Vec3.dot(correctedUp, position), -Vec3.dot(backward, position), 1,
    ]);
  },
  perspective(fovRadians, aspect, near, far) {
    const focal = 1 / Math.tan(fovRadians / 2);
    const range = 1 / (near - far);
    return new Float32Array([
      focal / aspect, 0, 0, 0,
      0, focal, 0, 0,
      0, 0, (near + far) * range, -1,
      0, 0, 2 * near * far * range, 0,
    ]);
  },
  orthographic(left, right, bottom, top, near, far) {
    return new Float32Array([
      2 / (right - left), 0, 0, 0,
      0, 2 / (top - bottom), 0, 0,
      0, 0, -2 / (far - near), 0,
      -(right + left) / (right - left),
      -(top + bottom) / (top - bottom),
      -(far + near) / (far - near),
      1,
    ]);
  },
};