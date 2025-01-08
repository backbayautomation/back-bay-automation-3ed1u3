import React from 'react'; // ^18.2.0
import { render, fireEvent, waitFor, screen } from '@testing-library/react'; // ^14.0.0
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'; // ^29.0.0
import userEvent from '@testing-library/user-event'; // ^14.0.0
import { axe, toHaveNoViolations } from 'jest-axe'; // ^4.7.0

import FormField, { FormFieldProps } from '../../src/components/common/Forms/FormField';
import SearchField, { SearchFieldProps } from '../../src/components/common/Forms/SearchField';
import SelectField from '../../src/components/common/Forms/SelectField';

// Add jest-axe matchers
expect.extend(toHaveNoViolations);

// Mock tenant context
const mockTenantContext = {
  id: 'tenant-1',
  validationRules: {
    maxLength: 50,
    required: true,
    patterns: {
      email: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
      phone: /^\+?[1-9]\d{1,14}$/
    }
  },
  theme: {
    colors: {
      primary: '#0066CC',
      error: '#DC3545'
    }
  }
};

describe('FormField Component', () => {
  const defaultProps: FormFieldProps = {
    name: 'test-field',
    label: 'Test Field',
    value: '',
    onChange: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render without accessibility violations', async () => {
    const { container } = render(<FormField {...defaultProps} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should handle tenant-specific validation rules', async () => {
    const onChange = jest.fn();
    const { getByRole } = render(
      <FormField
        {...defaultProps}
        required={mockTenantContext.validationRules.required}
        maxLength={mockTenantContext.validationRules.maxLength}
        onChange={onChange}
      />
    );

    const input = getByRole('textbox');
    await userEvent.type(input, 'a'.repeat(51));

    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(onChange).toHaveBeenCalledTimes(51);
  });

  it('should handle input masking per tenant configuration', async () => {
    const onChange = jest.fn();
    const { getByRole } = render(
      <FormField
        {...defaultProps}
        type="email"
        onChange={onChange}
      />
    );

    const input = getByRole('textbox');
    await userEvent.type(input, 'invalid@email');

    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(/invalid email format/i)).toBeInTheDocument();
  });

  it('should maintain focus management for keyboard navigation', async () => {
    const { getByRole } = render(
      <FormField {...defaultProps} required />
    );

    const input = getByRole('textbox');
    await userEvent.tab();
    expect(input).toHaveFocus();

    await userEvent.keyboard('{Tab}');
    expect(input).not.toHaveFocus();
  });
});

describe('SearchField Component', () => {
  const defaultProps: SearchFieldProps = {
    value: '',
    onSearch: jest.fn(),
    onChange: jest.fn()
  };

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('should debounce search with configured timeout', async () => {
    const onSearch = jest.fn();
    const { getByRole } = render(
      <SearchField
        {...defaultProps}
        onSearch={onSearch}
        debounceMs={300}
      />
    );

    const input = getByRole('searchbox');
    await userEvent.type(input, 'test query');

    expect(onSearch).not.toHaveBeenCalled();

    jest.advanceTimersByTime(300);
    await waitFor(() => {
      expect(onSearch).toHaveBeenCalledWith('test query');
    });
  });

  it('should handle loading states accessibly', async () => {
    const { getByRole, rerender } = render(
      <SearchField {...defaultProps} isLoading={true} />
    );

    const searchbox = getByRole('searchbox');
    expect(searchbox).toHaveAttribute('aria-busy', 'true');

    rerender(<SearchField {...defaultProps} isLoading={false} />);
    expect(searchbox).toHaveAttribute('aria-busy', 'false');
  });

  it('should support keyboard shortcuts for clear action', async () => {
    const onClear = jest.fn();
    const { getByRole } = render(
      <SearchField
        {...defaultProps}
        value="test"
        onClear={onClear}
      />
    );

    const searchbox = getByRole('searchbox');
    await userEvent.type(searchbox, '{Escape}');

    expect(onClear).toHaveBeenCalled();
  });
});

describe('SelectField Component', () => {
  const options = [
    { value: '1', label: 'Option 1' },
    { value: '2', label: 'Option 2' },
    { value: '3', label: 'Option 3' }
  ];

  it('should support keyboard navigation in dropdown', async () => {
    const onChange = jest.fn();
    const { getByRole } = render(
      <SelectField
        name="test-select"
        label="Test Select"
        options={options}
        value=""
        onChange={onChange}
      />
    );

    const select = getByRole('combobox');
    await userEvent.tab();
    expect(select).toHaveFocus();

    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{Enter}');

    expect(onChange).toHaveBeenCalledWith('1');
  });

  it('should handle multi-select with screen reader announcements', async () => {
    const onChange = jest.fn();
    const { getByRole, getAllByRole } = render(
      <SelectField
        name="test-select"
        label="Test Select"
        options={options}
        value={[]}
        multiple={true}
        onChange={onChange}
      />
    );

    const select = getByRole('combobox');
    await userEvent.click(select);

    const options = getAllByRole('option');
    await userEvent.click(options[0]);
    await userEvent.click(options[1]);

    expect(onChange).toHaveBeenCalledWith(['1', '2']);
    expect(select).toHaveAttribute('aria-multiselectable', 'true');
  });

  it('should maintain selection order in multi-select', async () => {
    const onChange = jest.fn();
    const { getByRole, getAllByRole } = render(
      <SelectField
        name="test-select"
        label="Test Select"
        options={options}
        value={['2', '1']}
        multiple={true}
        onChange={onChange}
      />
    );

    const select = getByRole('combobox');
    await userEvent.click(select);

    const selectedOptions = getAllByRole('option', { selected: true });
    expect(selectedOptions[0]).toHaveTextContent('Option 2');
    expect(selectedOptions[1]).toHaveTextContent('Option 1');
  });
});