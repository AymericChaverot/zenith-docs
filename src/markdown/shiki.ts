import {
  transformerMetaHighlight,
  transformerMetaWordHighlight,
  transformerNotationDiff,
  transformerNotationFocus,
  transformerNotationHighlight,
  transformerNotationWordHighlight,
} from '@shikijs/transformers';
import type { ShikiTransformer } from 'shiki';

export function zenithShikiTransformers(): ShikiTransformer[] {
  return [
    metaTransformer(),
    transformerMetaHighlight(),
    transformerMetaWordHighlight(),
    transformerNotationHighlight({ matchAlgorithm: 'v3' }),
    transformerNotationWordHighlight({ matchAlgorithm: 'v3' }),
    transformerNotationDiff({ matchAlgorithm: 'v3' }),
    transformerNotationFocus({ matchAlgorithm: 'v3' }),
  ];
}

/** Read `title="..."` and `lineNumbers` from the code fence meta string. */
function metaTransformer(): ShikiTransformer {
  return {
    name: 'zenith-meta',
    preprocess() {
      // Astro may pass the meta as a plain string; the meta transformers expect `__raw`.
      const meta = this.options.meta as unknown;
      if (typeof meta === 'string') this.options.meta = { __raw: meta };
    },
    pre(node) {
      const raw = this.options.meta?.__raw ?? '';
      const title = /title=(?:"([^"]*)"|'([^']*)'|(\S+))/.exec(raw);
      const value = title?.[1] ?? title?.[2] ?? title?.[3];
      if (value) node.properties['data-title'] = value;
      node.properties['data-language'] = this.options.lang;

      const lineNumbers = /\blineNumbers(?:=(\d+))?/.exec(raw);
      if (lineNumbers) {
        this.addClassToHast(node, 'line-numbers');
        if (lineNumbers[1]) node.properties.style = `--start: ${Number(lineNumbers[1]) - 1}`;
      }
    },
  };
}
