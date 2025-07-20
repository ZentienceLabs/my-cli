declare module 'ink-select-input' {
    import { Component } from 'react';

    interface Item {
        label: string;
        value: any;
    }

    interface SelectInputProps {
        items?: Item[];
        onSelect?: (item: Item) => void;
        initialIndex?: number;
        focus?: boolean;
    }

    export default class SelectInput extends Component<SelectInputProps> {}
}
