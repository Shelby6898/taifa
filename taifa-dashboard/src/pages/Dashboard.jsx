export default function Dashboard() {

  const user =
    JSON.parse(localStorage.getItem("user"));

  return (
    <div style={{ padding: "20px" }}>

      <h1>Dashboard</h1>

      <p>
        Welcome {user?.name}
      </p>

      <p>
        Role: {user?.role}
      </p>

    </div>
  );
}
