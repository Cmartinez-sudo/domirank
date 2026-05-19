export function SignOutButton() {
  return (
    <form action="/auth/signout" method="post">
      <button type="submit" className="nav-link">Salir</button>
    </form>
  );
}
