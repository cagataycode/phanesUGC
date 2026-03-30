import { generateScriptSubtitles } from './subtitle-chunker';

describe('subtitle-chunker', () => {
  it('chunks words into phrase-level intervals using WPM generation', () => {
    const text = 'This is a great product for creators.';
    const duration = 2.0;
    const phrases = generateScriptSubtitles(text, duration, {
      maxWordsPerPhrase: 4,
      minWordsPerPhrase: 3,
    });

    // 7 words total. secondsPerWord = 2 / 7 = 0.2857.
    // Chunk 1: 'This is a great' (4 words -> should break at maxWords)
    // Chunk 2: 'product for creators.'
    expect(phrases).toHaveLength(2);

    expect(phrases[0]).toMatchObject({
      text: 'This is a great',
      start: 0,
      end: 1.143,
    });

    expect(phrases[1]).toMatchObject({
      text: 'product for creators.',
      start: 1.143,
      end: 2.0,
    });

    expect(phrases[0].lines).toHaveLength(2); // 'This is' \n 'a great'
    expect(phrases[1].lines).toHaveLength(2); // 'product for' \n 'creators.'
  });

  it('splits on strong punctuation early if min threshold met', () => {
    const text = 'Stop. You need this now. It saves hours.';
    const duration = 3.0;
    // 8 words, 3.0 sec => 0.375 per word
    const phrases = generateScriptSubtitles(text, duration, {
      maxWordsPerPhrase: 5,
      minWordsPerPhrase: 3,
    });

    // "Stop. You need" (3 w) vs wait for "now." (5 w)
    // Wait, let's see:
    // i=0 "Stop." (hard=T, len=1, min=F) -> no break
    // i=1 "You"
    // i=2 "need" (len=3, min=T, hard=F) -> no break
    // i=3 "this"
    // i=4 "now." (hard=T, len=5, max=T, min=T) -> break. "Stop. You need this now."
    // i=5 "It"
    // i=6 "saves"
    // i=7 "hours." (last) -> break. "It saves hours."
    expect(phrases).toHaveLength(2);
    expect(phrases[0].text).toBe('Stop. You need this now.');
    expect(phrases[1].text).toBe('It saves hours.');
  });

  it('returns empty array when text is empty', () => {
    const phrases = generateScriptSubtitles('   ', 5.0);
    expect(phrases).toEqual([]);
  });
});
