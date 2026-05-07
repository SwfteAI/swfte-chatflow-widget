import type { ChatFlowState, ChatFlowAction, ChatFlowMessage } from '../types';

type Listener = () => void;

const INITIAL_STATE: ChatFlowState = {
  status: 'idle',
  sessionId: null,
  messages: [],
  collectedData: {},
  currentFieldId: null,
  progressPercent: 0,
  isSending: false,
  error: null,
};

function reducer(state: ChatFlowState, action: ChatFlowAction): ChatFlowState {
  switch (action.type) {
    case 'SET_STATUS':
      return { ...state, status: action.payload, error: action.payload === 'error' ? state.error : null };
    case 'SET_SESSION':
      return { ...state, sessionId: action.payload, status: 'active' };
    case 'ADD_MESSAGE':
      return { ...state, messages: [...state.messages, action.payload] };
    case 'SET_SENDING':
      return { ...state, isSending: action.payload };
    case 'SET_COLLECTED_DATA':
      return { ...state, collectedData: { ...state.collectedData, ...action.payload } };
    case 'SET_PROGRESS':
      return { ...state, currentFieldId: action.payload.fieldId, progressPercent: action.payload.percent };
    case 'SET_ERROR':
      return { ...state, error: action.payload, status: action.payload ? 'error' : state.status };
    case 'RESET':
      return { ...INITIAL_STATE };
    default:
      return state;
  }
}

export class ChatFlowStore {
  private state: ChatFlowState;
  private listeners: Set<Listener> = new Set();

  constructor() {
    this.state = { ...INITIAL_STATE };
  }

  getState(): Readonly<ChatFlowState> {
    return this.state;
  }

  dispatch(action: ChatFlowAction): void {
    const prev = this.state;
    this.state = reducer(prev, action);
    if (this.state !== prev) {
      this.listeners.forEach((fn) => fn());
    }
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  // Convenience selectors
  get messages(): readonly ChatFlowMessage[] { return this.state.messages; }
  get collectedData(): Readonly<Record<string, unknown>> { return this.state.collectedData; }
  get isActive(): boolean { return this.state.status === 'active'; }
  get isComplete(): boolean { return this.state.status === 'completed'; }
  get isSending(): boolean { return this.state.isSending; }
}
