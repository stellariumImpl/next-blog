declare module "kuroshiro" {
  class Kuroshiro {
    init(analyzer: unknown): Promise<Kuroshiro>;
    convert(
      value: string,
      options?: {
        to?: string;
        romajiSystem?: string;
        mode?: string;
      }
    ): Promise<string>;
  }
  export default Kuroshiro;
}

declare module "kuroshiro-analyzer-kuromoji" {
  class KuromojiAnalyzer {}
  export default KuromojiAnalyzer;
}
