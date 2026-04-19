import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Filters } from "./Filters";
import type { FilterState } from "../lib/dataset";

const OPTIONS = [
  { value: "BE", label: "Belgium" },
  { value: "FR", label: "France" },
  { value: "NL", label: "Netherlands" }
];

function renderFilters(filters: FilterState, onChange = vi.fn()) {
  return {
    onChange,
    ...render(<Filters countryOptions={OPTIONS} filters={filters} mode="desktop" onChange={onChange} />)
  };
}

describe("Filters", () => {
  it("does not render the Countries title", () => {
    renderFilters({ countryCodes: ["BE"] });
    expect(screen.queryByText("Countries")).not.toBeInTheDocument();
  });

  it("shows the selected count in the trigger button", () => {
    renderFilters({ countryCodes: ["BE", "FR"] });
    expect(screen.getByRole("button", { name: /2 countries selected/i })).toBeInTheDocument();
  });

  it("shows selected countries as flag images in the trigger label", () => {
    const { container } = renderFilters({ countryCodes: ["BE", "FR"] });
    const trigger = screen.getByRole("button", { name: /2 countries selected/i });
    expect(trigger).toBeInTheDocument();
    expect(container.querySelectorAll(".country-filter-trigger .country-flag")).toHaveLength(2);
  });

  it("shows 'All countries' when every option is selected", () => {
    renderFilters({ countryCodes: ["BE", "FR", "NL"] });
    expect(screen.getByRole("button", { name: /All countries/i })).toBeInTheDocument();
  });

  it("hides the selected country emoji list when nothing is selected", () => {
    renderFilters({ countryCodes: [] });
    expect(screen.getByRole("button", { name: /0 countries selected/i })).toHaveTextContent("0 countries selected");
  });

  it("opens the desktop dialog on click and shows checkboxes", async () => {
    const user = userEvent.setup();
    renderFilters({ countryCodes: ["BE"] });

    expect(screen.queryByLabelText(/Belgium/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /1 country selected/i }));
    expect(screen.getByRole("dialog", { name: /Country selector/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Belgium/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/France/i)).toBeInTheDocument();
  });

  it("toggles a country on checkbox click", async () => {
    const user = userEvent.setup();
    const { onChange } = renderFilters({ countryCodes: ["BE", "FR"] });

    await user.click(screen.getByRole("button", { name: /2 countries selected/i }));
    await user.click(screen.getByLabelText(/France/i));
    expect(onChange).toHaveBeenCalledWith({ countryCodes: ["BE"] });
  });

  it("selects all countries", async () => {
    const user = userEvent.setup();
    const { onChange } = renderFilters({ countryCodes: ["BE"] });

    await user.click(screen.getByRole("button", { name: /1 country selected/i }));
    await user.click(screen.getByRole("button", { name: /Select all/i }));
    expect(onChange).toHaveBeenCalledWith({ countryCodes: ["BE", "FR", "NL"] });
  });

  it("clears all countries", async () => {
    const user = userEvent.setup();
    const { onChange } = renderFilters({ countryCodes: ["BE", "FR"] });

    await user.click(screen.getByRole("button", { name: /2 countries selected/i }));
    await user.click(screen.getByRole("button", { name: /Clear all/i }));
    expect(onChange).toHaveBeenCalledWith({ countryCodes: [] });
  });

  it("filters options by search query", async () => {
    const user = userEvent.setup();
    renderFilters({ countryCodes: ["BE"] });

    await user.click(screen.getByRole("button", { name: /1 country selected/i }));
    await user.type(screen.getByPlaceholderText(/Type a country name/i), "bel");
    expect(screen.getByLabelText(/Belgium/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/France/i)).not.toBeInTheDocument();
  });

  it("shows empty message when search has no matches", async () => {
    const user = userEvent.setup();
    renderFilters({ countryCodes: [] });

    await user.click(screen.getByRole("button", { name: /0 countries/i }));
    await user.type(screen.getByPlaceholderText(/Type a country name/i), "zzzzz");
    expect(screen.getByText(/No countries match/i)).toBeInTheDocument();
  });

  it("closes the desktop dialog on Escape", async () => {
    const user = userEvent.setup();
    renderFilters({ countryCodes: ["BE"] });

    await user.click(screen.getByRole("button", { name: /1 country selected/i }));
    expect(screen.getByLabelText(/Belgium/i)).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByLabelText(/Belgium/i)).not.toBeInTheDocument();
  });

  it("closes the desktop dialog when clicking outside the selector", async () => {
    const user = userEvent.setup();
    renderFilters({ countryCodes: ["BE"] });

    await user.click(screen.getByRole("button", { name: /1 country selected/i }));
    expect(screen.getByRole("dialog", { name: /Country selector/i })).toBeInTheDocument();
    await user.click(document.body);
    expect(screen.queryByRole("dialog", { name: /Country selector/i })).not.toBeInTheDocument();
  });
});
