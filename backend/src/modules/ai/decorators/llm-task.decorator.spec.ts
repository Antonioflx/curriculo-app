import { getLlmTaskOptions, LlmTask } from './llm-task.decorator';

class Tasks {
  @LlmTask({ temperature: 0, topK: 1 })
  precise() {}

  @LlmTask({ provider: 'gemini', temperature: 0.7 })
  creative() {}

  plain() {}
}

describe('@LlmTask', () => {
  it('guarda as opções por método e permite lê-las pelo nome', () => {
    expect(getLlmTaskOptions(Tasks.prototype, 'precise')).toEqual({ temperature: 0, topK: 1 });
    expect(getLlmTaskOptions(Tasks.prototype, 'creative')).toEqual({ provider: 'gemini', temperature: 0.7 });
  });

  it('método sem o decorator devolve opções vazias (usa os padrões)', () => {
    expect(getLlmTaskOptions(Tasks.prototype, 'plain')).toEqual({});
    expect(getLlmTaskOptions(Tasks.prototype, 'inexistente')).toEqual({});
  });
});
