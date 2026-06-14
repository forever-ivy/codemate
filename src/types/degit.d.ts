declare module 'degit' {
  export interface DegitOptions {
    cache?: boolean;
    force?: boolean;
    verbose?: boolean;
  }

  export interface DegitEmitter {
    clone(dest: string): Promise<void>;
  }

  export default function degit(src: string, options?: DegitOptions): DegitEmitter;
}
