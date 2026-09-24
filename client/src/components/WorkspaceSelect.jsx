import Select from 'react-select';

export default function WorkspaceSelect({ workspaces, activeId, onChange, disabled }) {
  const options = workspaces.map((ws) => ({
    value: ws.id,
    label: ws.id === activeId ? `${ws.name} (current)` : ws.name,
  }));
  const value = options.find((o) => o.value === activeId) || null;

  return (
    <Select
      className="workspace-select"
      classNamePrefix="ws-select"
      unstyled
      isDisabled={disabled}
      isSearchable
      options={options}
      value={value}
      onChange={(opt) => opt && onChange(opt.value)}
      placeholder={disabled ? 'No workspaces' : 'Select a workspace'}
      noOptionsMessage={() => 'No workspaces'}
      classNames={{
        control: (state) => `ws-select__control${state.isFocused ? ' is-focused' : ''}`,
        valueContainer: () => 'ws-select__value-container',
        menu: () => 'ws-select__menu',
        menuList: () => 'ws-select__menu-list',
        option: (state) =>
          `ws-select__option${state.isFocused ? ' is-focused' : ''}${state.isSelected ? ' is-selected' : ''}`,
        singleValue: () => 'ws-select__single-value',
        placeholder: () => 'ws-select__placeholder',
        input: () => 'ws-select__input',
        indicatorSeparator: () => 'ws-select__indicator-separator',
        dropdownIndicator: () => 'ws-select__dropdown-indicator',
        noOptionsMessage: () => 'ws-select__no-options',
      }}
    />
  );
}
