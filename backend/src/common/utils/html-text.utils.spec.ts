import { htmlToText } from './html-text.utils';

describe('htmlToText', () => {
  it('tira script, estilo, head e comentários', () => {
    const html =
      '<html><head><title>x</title><style>p{}</style></head><body><!-- c --><script>alert(1)</script><p>Olá</p></body></html>';
    expect(htmlToText(html)).toBe('Olá');
  });

  it('cada bloco vira uma linha e o espaço é normalizado', () => {
    expect(htmlToText('<h1>Nome</h1><p>Dev   <br>Backend</p><ul><li>a</li><li>b</li></ul>')).toBe(
      'Nome\nDev\nBackend\na\nb',
    );
  });

  it('negrito vira **texto** e link vira "texto (url)"', () => {
    expect(htmlToText('<li>Reduzi <strong>40%</strong> e <b>R$ 2 mil</b></li>')).toBe('Reduzi **40%** e **R$ 2 mil**');
    expect(htmlToText('<a class="x" href="https://github.com/a">GitHub</a>')).toBe('GitHub (https://github.com/a)');
  });

  it('decodifica entidades sem reinterpretar o resultado como tag', () => {
    expect(htmlToText('<p>Tom &amp; Jerry &#233; &#xE9; &nbsp;ok</p>')).toBe('Tom & Jerry é é ok');
    expect(htmlToText('<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>')).toBe('<script>alert(1)</script>');
    expect(htmlToText('<p>&amp;lt; &#99999999999;</p>')).toBe('&lt; &#99999999999;');
  });

  it('HTML sem texto dá string vazia', () => {
    expect(htmlToText('<div><script>x</script></div>')).toBe('');
  });
});
