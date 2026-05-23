declare module "apache-arrow" {
  export class Schema {
    constructor(fields: Field[]);
  }
  export class Field {
    constructor(name: string, type: any, nullable?: boolean);
  }
  export class FixedSizeList {
    constructor(size: number, field: Field);
  }
  export class Float32 {}
  export class Int64 {}
  export class Utf8 {}
}
