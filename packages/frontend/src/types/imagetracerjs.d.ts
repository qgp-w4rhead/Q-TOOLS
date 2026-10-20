/**
 * Type declarations for `imagetracerjs` (v1.2.6, Unlicense).
 * The package ships a UMD singleton: `module.exports = new ImageTracer()`.
 */
declare module 'imagetracerjs' {
  /** A palette entry produced by color quantization. */
  export interface TracePaletteColor {
    r: number;
    g: number;
    b: number;
    a: number;
  }

  /** One fitted segment of a traced path (L = line, Q = quadratic spline). */
  export interface TracedPathSegment {
    type: 'L' | 'Q';
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    x3: number;
    y3: number;
  }

  export interface TracedPath {
    segments: TracedPathSegment[];
    isholepath: boolean;
    boundingbox: [number, number, number, number];
    ischildren?: boolean;
  }

  /** Result of `imagedataToTracedata`: one layer per palette color. */
  export interface TracedData {
    layers: TracedPath[][];
    palette: TracePaletteColor[];
    width: number;
    height: number;
  }

  /** Minimal ImageData shape accepted by the tracer. */
  export interface TraceImageData {
    width: number;
    height: number;
    data: Uint8ClampedArray | number[];
  }

  /** Options object - every key is optional, defaults come from the 'default' preset. */
  export interface TraceOptions {
    corsenabled?: boolean;
    ltres?: number;
    qtres?: number;
    pathomit?: number;
    rightangleenhance?: boolean;
    colorsampling?: number;
    numberofcolors?: number;
    mincolorratio?: number;
    colorquantcycles?: number;
    layering?: number;
    strokewidth?: number;
    linefilter?: boolean;
    scale?: number;
    roundcoords?: number;
    viewbox?: boolean;
    desc?: boolean;
    lcpr?: number;
    qcpr?: number;
    blurradius?: number;
    blurdelta?: number;
    pal?: TracePaletteColor[];
    [key: string]: unknown;
  }

  interface ImageTracerApi {
    versionnumber: string;
    optionpresets: Record<string, TraceOptions>;
    checkoptions(options?: TraceOptions | string): TraceOptions;
    imagedataToSVG(imgd: TraceImageData, options?: TraceOptions | string): string;
    imagedataToTracedata(imgd: TraceImageData, options?: TraceOptions | string): TracedData;
    getsvgstring(tracedata: TracedData, options?: TraceOptions | string): string;
    imageToSVG(url: string, callback: (svg: string) => void, options?: TraceOptions | string): void;
    imageToTracedata(url: string, callback: (td: TracedData) => void, options?: TraceOptions | string): void;
    appendSVGString(svgstr: string, parentid: string): void;
  }

  const ImageTracer: ImageTracerApi;
  export default ImageTracer;
}
