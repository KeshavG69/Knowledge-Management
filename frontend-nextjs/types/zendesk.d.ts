// Type declarations for Zendesk Web Widget

type ZendeskCommand = 'messenger' | 'messenger:set' | 'messenger:on';
type ZendeskAction = 'show' | 'hide' | 'open' | 'close' | 'toggle';
type ZendeskEvent = 'open' | 'close' | 'unreadMessages';

interface ZendeskMessengerSettings {
  color?: string;
  launcher?: string;
  conversationFields?: Array<{
    id: string;
    value: string;
  }>;
  cookies?: boolean;
}

interface ZendeskFunction {
  (command: 'messenger', action: ZendeskAction): void;
  (command: 'messenger:set', setting: string, value: ZendeskMessengerSettings): void;
  (command: 'messenger:on', event: ZendeskEvent, callback: (data?: any) => void): void;
}

interface Window {
  zE?: ZendeskFunction;
  zESettings?: {
    webWidget?: {
      color?: {
        theme?: string;
        launcher?: string;
        launcherText?: string;
      };
      offset?: {
        horizontal?: string;
        vertical?: string;
      };
      position?: {
        horizontal?: 'left' | 'right';
        vertical?: 'top' | 'bottom';
      };
    };
  };
}
