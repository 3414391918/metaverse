/** Scoped to the pinned Harness UI; workspace identity remains a runtime fact. */
export const sessionListStyle = `
.mv-sessions-list [class$="_sectionHeader"],
.mv-sessions-list [class$="_projectRow"],
.mv-center [class$="_heroWorkspaceRow"] > button[aria-haspopup="menu"] {
  display: none !important;
}
.mv-sessions-list [class$="_root"] {
  padding-right: 0;
}
.mv-sessions-list [class$="_groupSection"] {
  margin: 0;
  --dsh-workspace-indent: 0px !important;
}
.mv-sessions-list [class*="_sessionRow"] {
  min-height: 42px;
  height: auto;
  margin: 4px 0;
  padding: 8px 10px;
  border-radius: 10px;
  box-sizing: border-box;
  transition: background-color 120ms ease;
}
.mv-sessions-list [class*="_sessionRow"]:hover {
  background: var(--dsw-alias-interactive-bg-hover, #8882);
}
.mv-sessions-list [class*="_sessionRow"][class*="_selected"] {
  background: var(--dsw-alias-interactive-bg-hover, #8882);
  box-shadow: inset 2px 0 0 #6fa8ff;
}
.mv-sessions-list [class*="_sessionRow"] [class$="_title"] {
  margin-left: 0;
  font-size: 14px;
  line-height: 22px;
}
.mv-sessions-list [class*="_sessionRow"] [class$="_time"],
.mv-sessions-list [class*="_sessionRow"] > [class$="_slot"],
.mv-sessions-list [class$="_searchResultWorkspace"] {
  display: none;
}
`;
