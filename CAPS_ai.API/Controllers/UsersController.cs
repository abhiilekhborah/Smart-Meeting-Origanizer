using Microsoft.AspNetCore.Mvc;
using CAPS_ai.API.DTOs;
using CAPS_ai.API.Services;
namespace CAPS_ai.API.Controllers;

[ApiController, Route("api/users")]
public class UsersController(SessionService sessions) : ControllerBase
{
    [HttpGet("me"), ProducesResponseType(typeof(UserResponseDto), 200)]
    public async Task<IActionResult> Me() => Ok(await sessions.Me());
    [HttpPost("heartbeat"), ProducesResponseType(typeof(UserResponseDto), 200)]
    public async Task<IActionResult> Heartbeat() => Ok(await sessions.Heartbeat());
}
